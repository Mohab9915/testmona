"""
Asana API client for issue tracker integration.
Handles creating, updating, and syncing tasks with Asana.
"""
import requests
import time
from typing import Optional, Dict, Any, List
from datetime import datetime
from .base_client import BaseClient


class AsanaClient(BaseClient):
    """Client for interacting with Asana API."""
    
    def __init__(self, api_url: str, api_token: str, workspace_id: str, project_id: str, timeout: int = 30):
        """
        Initialize Asana client.
        
        Args:
            api_url: Asana API URL (e.g., https://app.asana.com/api/1.0)
            api_token: Asana personal access token
            workspace_id: Asana workspace ID
            project_id: Asana project ID
            timeout: Timeout for API requests (optional, default: 30)
        """
        super().__init__(timeout=timeout)
        self.api_url = api_url.rstrip('/')
        self.api_token = api_token
        self.workspace_id = workspace_id
        self.project_id = project_id
    
    def get_headers(self) -> Dict[str, str]:
        """Get Asana API headers."""
        return {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }
    
    def get_rate_limit_status_code(self) -> int:
        """Asana returns 429 for rate limiting."""
        return 429
    
    def handle_rate_limit(self, response: requests.Response) -> Optional[int]:
        """
        Handle Asana rate limiting.
        
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
        """Get error message for Asana status codes."""
        if status_code == 401:
            return "Asana API authentication failed. Invalid or expired token."
        elif status_code == 403:
            return "Asana API access forbidden. Check permissions."
        elif status_code == 404:
            return "Resource not found in Asana."
        elif status_code == 422:
            return "Validation error."
        elif status_code >= 500:
            return f"Asana API server error: {status_code}"
        return f"Asana API error: {status_code}"
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test connection to Asana API.
        
        Returns:
            Dict with success status and message
        """
        try:
            # Test by getting user info
            response = self._make_request(
                'GET',
                f"{self.api_url}/users/me",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'message': 'Successfully connected to Asana',
                    'user': response.json().get('data')
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to connect to Asana: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection error: {str(e)}'
            }
    
    def create_task(self, name: str, notes: str, assignee_id: Optional[str] = None, 
                   priority: str = 'Medium', due_on: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new task in Asana.
        
        Args:
            name: Task name
            notes: Task description
            assignee_id: Assignee user ID
            priority: Priority (High, Medium, Low)
            due_on: Due date (YYYY-MM-DD format)
            
        Returns:
            Dict with task data or error
        """
        try:
            payload = {
                'data': {
                    'name': name,
                    'notes': notes,
                    'projects': [self.project_id],
                    'workspace': self.workspace_id
                }
            }
            
            if assignee_id:
                payload['data']['assignee'] = assignee_id
            
            if due_on:
                payload['data']['due_on'] = due_on
            
            # Add priority as a custom field if available
            if priority:
                payload['data']['completed'] = False
            
            response = self._make_request(
                'POST',
                f"{self.api_url}/tasks",
                headers=self.headers,
                json=payload
            )
            
            if response.status_code == 201:
                task = response.json()
                return {
                    'success': True,
                    'task_id': task.get('data', {}).get('gid'),
                    'task_url': f"https://app.asana.com/0/{self.project_id}/{task.get('data', {}).get('gid')}",
                    'task': task
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to create task: {response.status_code} - {response.text}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error creating task: {str(e)}'
            }
    
    def update_task(self, task_id: str, name: Optional[str] = None, notes: Optional[str] = None, 
                    priority: Optional[str] = None) -> Dict[str, Any]:
        """
        Update an existing task in Asana.
        
        Args:
            task_id: Task ID
            name: New name (optional)
            notes: New notes (optional)
            priority: New priority (optional)
            
        Returns:
            Dict with task data or error
        """
        try:
            payload = {'data': {}}
            
            if name:
                payload['data']['name'] = name
            
            if notes:
                payload['data']['notes'] = notes
            
            response = self._make_request(
                'PUT',
                f"{self.api_url}/tasks/{task_id}",
                headers=self.headers,
                json=payload
            )
            
            if response.status_code == 200:
                task = response.json()
                return {
                    'success': True,
                    'task': task
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to update task: {response.status_code} - {response.text}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error updating task: {str(e)}'
            }
    
    def get_task(self, task_id: str) -> Dict[str, Any]:
        """
        Get a task from Asana.
        
        Args:
            task_id: Task ID
            
        Returns:
            Dict with task data or error
        """
        try:
            response = self._make_request(
                'GET',
                f"{self.api_url}/tasks/{task_id}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'task': response.json()
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to get task: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error getting task: {str(e)}'
            }
