"""
GitLab API client for issue tracker integration.
Handles creating, updating, and syncing issues with GitLab.
"""
import requests
import time
from typing import Optional, Dict, Any, List
from datetime import datetime
from .base_client import BaseClient


class GitLabClient(BaseClient):
    """Client for interacting with GitLab API."""
    
    def __init__(self, api_url: str, api_token: str, namespace: str, project_name: Optional[str] = None, timeout: int = 30):
        """
        Initialize GitLab client.
        
        Args:
            api_url: GitLab API URL (e.g., https://gitlab.com/api/v4)
            api_token: GitLab personal access token
            namespace: Namespace (user or group)
            project_name: Project name (optional, can be included in namespace)
            timeout: Timeout for API requests (optional, default: 30)
        """
        super().__init__(timeout=timeout)
        self.api_url = api_url.rstrip('/')
        self.api_token = api_token
        self.namespace = namespace
        self.project_name = project_name
        
        # Determine full project path (URL-encoded)
        if project_name:
            self.project_path = f"{namespace}%2F{project_name}"
            self.project_path_display = f"{namespace}/{project_name}"
        else:
            # Assume namespace contains "namespace/project"
            parts = namespace.split('/', 1)
            if len(parts) == 2:
                self.project_path = f"{parts[0]}%2F{parts[1]}"
                self.project_path_display = namespace
            else:
                self.project_path = namespace
                self.project_path_display = namespace
    
    def get_headers(self) -> Dict[str, str]:
        """Get GitLab API headers."""
        return {
            'PRIVATE-TOKEN': self.api_token,
            'Content-Type': 'application/json'
        }
    
    def get_rate_limit_status_code(self) -> int:
        """GitLab returns 429 for rate limiting."""
        return 429
    
    def handle_rate_limit(self, response: requests.Response) -> Optional[int]:
        """
        Handle GitLab rate limiting.
        
        Args:
            response: HTTP response object
            
        Returns:
            Wait time in seconds, or None if not rate limited
        """
        retry_after = response.headers.get('Retry-After')
        if retry_after:
            return int(retry_after)
        return 60  # Default wait time if no Retry-After header
    
    def get_error_message(self, status_code: int) -> str:
        """Get error message for GitLab status codes."""
        if status_code == 401:
            return "GitLab API authentication failed. Invalid or expired token."
        elif status_code == 403:
            return "GitLab API access forbidden. Check permissions."
        elif status_code == 404:
            return "Resource not found in GitLab."
        elif status_code == 422:
            return "Validation error."
        elif status_code >= 500:
            return f"GitLab API server error: {status_code}"
        return f"GitLab API error: {status_code}"
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test connection to GitLab API.
        
        Returns:
            Dict with success status and message
        """
        try:
            # Test by getting user info
            response = self._make_request('GET', f"{self.api_url}/user", headers=self.headers)
            
            if response.status_code == 200:
                # Also test if we can access the project
                project_response = self._make_request('GET', f"{self.api_url}/projects/{self.project_path}", headers=self.headers)
                
                if project_response.status_code == 200:
                    return {
                        'success': True,
                        'message': 'Successfully connected to GitLab and project',
                        'user': response.json().get('username'),
                        'project': self.project_path_display
                    }
                else:
                    return {
                        'success': False,
                        'message': f'Connected to GitLab but cannot access project: {project_response.status_code} - {project_response.json().get("message", "Unknown error")}'
                    }
            else:
                return {
                    'success': False,
                    'message': f'Authentication failed: {response.status_code} - {response.json().get("message", "Unknown error")}'
                }
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'message': 'Connection timeout'
            }
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'message': 'Connection error - unable to reach GitLab'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Unexpected error: {str(e)}'
            }
    
    def create_issue(self, title: str, description: str, labels: Optional[List[str]] = None,
                    assignee_id: Optional[int] = None, milestone_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Create a new issue in GitLab.
        
        Args:
            title: Issue title
            description: Issue description
            labels: List of labels to add
            assignee_id: User ID to assign the issue to
            milestone_id: Milestone ID to add
            
        Returns:
            Dict with issue data or error
        """
        try:
            issue_data = {
                'title': title,
                'description': description
            }
            
            if labels:
                issue_data['labels'] = ','.join(labels)
            
            if assignee_id:
                issue_data['assignee_id'] = assignee_id
            
            if milestone_id:
                issue_data['milestone_id'] = milestone_id
            
            response = self._make_request('POST', f"{self.api_url}/projects/{self.project_path}/issues", json=issue_data, headers=self.headers)
            
            if response.status_code == 201:
                issue = response.json()
                return {
                    'success': True,
                    'issue_id': str(issue['iid']),
                    'issue_url': issue['web_url'],
                    'issue': issue
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to create issue: {response.status_code} - {response.json().get("message", "Unknown error")}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error creating issue: {str(e)}'
            }
    
    def update_issue(self, issue_iid: int, title: Optional[str] = None,
                    description: Optional[str] = None, state_event: Optional[str] = None,
                    labels: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Update an existing issue in GitLab.
        
        Args:
            issue_iid: GitLab issue IID (internal ID)
            title: New title (optional)
            description: New description (optional)
            state_event: State event ('close' or 'reopen')
            labels: New labels (optional)
            
        Returns:
            Dict with updated issue data or error
        """
        try:
            issue_data = {}
            
            if title:
                issue_data['title'] = title
            if description:
                issue_data['description'] = description
            if state_event:
                issue_data['state_event'] = state_event
            if labels is not None:
                issue_data['labels'] = ','.join(labels)
            
            response = self._make_request('PUT', f"{self.api_url}/projects/{self.project_path}/issues/{issue_iid}", json=issue_data, headers=self.headers)
            
            if response.status_code == 200:
                issue = response.json()
                return {
                    'success': True,
                    'issue': issue
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to update issue: {response.status_code} - {response.json().get("message", "Unknown error")}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error updating issue: {str(e)}'
            }
    
    def get_issue(self, issue_iid: int) -> Dict[str, Any]:
        """
        Get an issue from GitLab.
        
        Args:
            issue_iid: GitLab issue IID (internal ID)
            
        Returns:
            Dict with issue data or error
        """
        try:
            response = self._make_request('GET', f"{self.api_url}/projects/{self.project_path}/issues/{issue_iid}", headers=self.headers)
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'issue': response.json()
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to get issue: {response.status_code} - {response.json().get("message", "Unknown error")}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error getting issue: {str(e)}'
            }
    
    def add_comment(self, issue_iid: int, body: str) -> Dict[str, Any]:
        """
        Add a comment to an issue.
        
        Args:
            issue_iid: GitLab issue IID (internal ID)
            body: Comment body
            
        Returns:
            Dict with comment data or error
        """
        try:
            response = self._make_request('POST', f"{self.api_url}/projects/{self.project_path}/issues/{issue_iid}/notes", json={'body': body}, headers=self.headers)
            
            if response.status_code == 201:
                return {
                    'success': True,
                    'comment': response.json()
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to add comment: {response.status_code} - {response.json().get("message", "Unknown error")}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error adding comment: {str(e)}'
            }
    
    def get_issues(self, state: str = 'opened', updated_after: Optional[datetime] = None,
                   labels: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Get issues from project.
        
        Args:
            state: Issue state ('opened', 'closed', 'all')
            updated_after: Only return issues updated after this date
            labels: Filter by labels
            
        Returns:
            Dict with list of issues or error
        """
        try:
            params = {'state': state}
            
            if updated_after:
                params['updated_after'] = updated_after.isoformat()
            
            if labels:
                params['labels'] = ','.join(labels)
            
            response = self._make_request('GET', f"{self.api_url}/projects/{self.project_path}/issues", params=params, headers=self.headers)
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'issues': response.json()
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to get issues: {response.status_code} - {response.json().get("message", "Unknown error")}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error getting issues: {str(e)}'
            }
    
    def get_user_by_username(self, username: str) -> Dict[str, Any]:
        """
        Get user ID by username (for assigning issues).
        
        Args:
            username: GitLab username
            
        Returns:
            Dict with user data or error
        """
        try:
            response = self._make_request('GET', f"{self.api_url}/users", params={'username': username}, headers=self.headers)
            
            if response.status_code == 200:
                users = response.json()
                if users and len(users) > 0:
                    return {
                        'success': True,
                        'user': users[0]
                    }
                else:
                    return {
                        'success': False,
                        'message': f'User not found: {username}'
                    }
            else:
                return {
                    'success': False,
                    'message': f'Failed to get user: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error getting user: {str(e)}'
            }
