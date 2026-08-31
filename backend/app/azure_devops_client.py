"""
Azure DevOps API client for issue tracker integration.
Handles creating, updating, and syncing work items with Azure DevOps.
"""
import requests
import time
from typing import Optional, Dict, Any, List
from datetime import datetime
from .base_client import BaseClient


class AzureDevOpsClient(BaseClient):

    # Every Azure DevOps REST call must carry an api-version. Without it ADO does
    # not return a clean error - it routes the request to the web front end and
    # replies 203 with an HTML sign-in page, which reads like an auth failure.
    API_VERSION = "7.0"
    """Client for interacting with Azure DevOps API."""
    
    def __init__(self, api_url: str, api_token: str, organization: str, project: str, timeout: int = 30):
        """
        Initialize Azure DevOps client.
        
        Args:
            api_url: Azure DevOps API URL (e.g., https://dev.azure.com)
            api_token: Azure DevOps personal access token
            organization: Azure DevOps organization name
            project: Azure DevOps project name
            timeout: Timeout for API requests (optional, default: 30)
        """
        super().__init__(timeout=timeout)
        self.api_url = api_url.rstrip('/')
        self.api_token = api_token
        self.organization = organization
        self.project = project
    
    def _encode_token(self, token: str) -> str:
        """Encode token for basic auth."""
        import base64
        credentials = f':{token}'
        return base64.b64encode(credentials.encode()).decode()
    
    def get_headers(self) -> Dict[str, str]:
        """Get Azure DevOps API headers."""
        return {
            'Authorization': f'Basic {self._encode_token(self.api_token)}',
            'Content-Type': 'application/json'
        }
    
    def get_rate_limit_status_code(self) -> int:
        """Azure DevOps returns 429 for rate limiting."""
        return 429
    
    def handle_rate_limit(self, response: requests.Response) -> Optional[int]:
        """
        Handle Azure DevOps rate limiting.
        
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
        """Get error message for Azure DevOps status codes."""
        if status_code == 401:
            return "Azure DevOps API authentication failed. Invalid or expired token."
        elif status_code == 403:
            return "Azure DevOps API access forbidden. Check permissions."
        elif status_code == 404:
            return "Resource not found in Azure DevOps."
        elif status_code == 422:
            return "Validation error."
        elif status_code >= 500:
            return f"Azure DevOps API server error: {status_code}"
        elif status_code in (203, 302):
            # ADO redirects API calls to an Entra ID sign-in page when the
            # organization will not accept the Basic/PAT credential at all. This is
            # returned before the token is evaluated, so it is NOT a scope problem:
            # a deliberately bogus token produces the identical response.
            return (
                "Azure DevOps redirected to a Microsoft sign-in page instead of answering the API. "
                "The organization is not accepting this personal access token: it may belong to a "
                "different organization, PAT/basic auth may be disabled by org policy, or a "
                "Conditional Access policy may be blocking non-interactive sign-in."
            )
        return f"Azure DevOps API error: {status_code}"
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test connection to Azure DevOps API.
        
        Returns:
            Dict with success status and message
        """
        try:
            # Test by getting project info
            response = self._make_request(
                'GET',
                f"{self.api_url}/{self.organization}/_apis/projects/{self.project}",
                headers=self.headers,
                params={"api-version": self.API_VERSION},
                allow_redirects=False,
            )
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'message': 'Successfully connected to Azure DevOps',
                    'project': response.json().get('name')
                }
            else:
                return {
                    'success': False,
                    'message': self.get_error_message(response.status_code)
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection error: {str(e)}'
            }
    
    def list_work_item_types(self) -> Dict[str, Any]:
        """List the work item types available in the configured project.

        The available set depends on the project process template: Basic has
        Issue/Epic/Task, while Agile/Scrum/CMMI have Bug. Callers use this to
        offer a real choice instead of assuming "Bug" exists.
        """
        try:
            response = self._make_request(
                'GET',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitemtypes",
                headers=self.headers,
                params={"api-version": self.API_VERSION},
                allow_redirects=False,
            )
            if response.status_code == 200:
                values = response.json().get("value", [])
                return {
                    'success': True,
                    'work_item_types': [
                        {"name": v.get("name"), "reference_name": v.get("referenceName")}
                        for v in values if v.get("name")
                    ],
                }
            return {
                'success': False,
                'message': self.get_error_message(response.status_code),
                'work_item_types': [],
            }
        except Exception as e:
            return {'success': False, 'message': str(e), 'work_item_types': []}

    def link_parent_work_item(self, work_item_id: str, parent_work_item_id: Optional[str]) -> Dict[str, Any]:
        """Set, replace, or clear a work item's hierarchical parent.

        Azure DevOps allows at most one "System.LinkTypes.Hierarchy-Reverse"
        relation per work item, and the JSON Patch API only supports add/remove
        (no "set") - so an existing parent relation must be removed by index
        before a new one can be added. Passing parent_work_item_id=None just
        removes any existing parent without adding a replacement.
        """
        try:
            current = self._make_request(
                'GET',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitems/{work_item_id}",
                headers=self.headers,
                params={"api-version": self.API_VERSION, "$expand": "relations"},
                allow_redirects=False,
            )
            if current.status_code != 200:
                return {
                    'success': False,
                    'message': f'Failed to read work item: {self.get_error_message(current.status_code)}',
                }

            relations = current.json().get('relations') or []
            patch_ops = []
            for index, relation in enumerate(relations):
                if relation.get('rel') == 'System.LinkTypes.Hierarchy-Reverse':
                    patch_ops.append({"op": "remove", "path": f"/relations/{index}"})
                    break  # ADO permits only one parent; nothing more to remove

            if parent_work_item_id is not None:
                parent_url = (
                    f"{self.api_url}/{self.organization}/{self.project}"
                    f"/_apis/wit/workitems/{parent_work_item_id}"
                )
                patch_ops.append({
                    "op": "add",
                    "path": "/relations/-",
                    "value": {
                        "rel": "System.LinkTypes.Hierarchy-Reverse",
                        "url": parent_url,
                    },
                })

            if not patch_ops:
                return {'success': True, 'work_item': current.json()}

            patch_headers = dict(self.headers)
            patch_headers['Content-Type'] = 'application/json-patch+json'

            response = self._make_request(
                'PATCH',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitems/{work_item_id}",
                headers=patch_headers,
                params={"api-version": self.API_VERSION},
                allow_redirects=False,
                json=patch_ops,
            )
            if response.status_code == 200:
                return {'success': True, 'work_item': response.json()}
            return {
                'success': False,
                'message': f'Failed to link parent work item: {response.status_code} - {response.text}',
            }
        except Exception as e:
            return {'success': False, 'message': f'Error linking parent work item: {str(e)}'}

    def search_work_items(
        self, query_text: str, work_item_types: Optional[List[str]] = None, limit: int = 20
    ) -> Dict[str, Any]:
        """Find work items in the configured project by title, for the parent picker.

        WIQL has no parameter binding, so the free-text query is escaped by
        doubling embedded single quotes (the language's own escape rule) before
        being interpolated into the query string.
        """
        try:
            safe_query = (query_text or "").replace("'", "''")
            type_clause = ""
            if work_item_types:
                quoted_types = ", ".join(f"'{t}'" for t in work_item_types)
                type_clause = f"AND [System.WorkItemType] IN ({quoted_types}) "

            wiql = {
                "query": (
                    "SELECT [System.Id] FROM WorkItems "
                    "WHERE [System.TeamProject] = @project "
                    f"{type_clause}"
                    f"AND [System.Title] CONTAINS '{safe_query}' "
                    "ORDER BY [System.ChangedDate] DESC"
                )
            }
            wiql_response = self._make_request(
                'POST',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/wiql",
                headers=self.headers,
                params={"api-version": self.API_VERSION, "$top": limit},
                allow_redirects=False,
                json=wiql,
            )
            if wiql_response.status_code != 200:
                return {
                    'success': False,
                    'message': f'Search failed: {self.get_error_message(wiql_response.status_code)}',
                    'work_items': [],
                }

            ids = [str(item['id']) for item in wiql_response.json().get('workItems', [])][:limit]
            if not ids:
                return {'success': True, 'work_items': []}

            batch_response = self._make_request(
                'GET',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitems",
                headers=self.headers,
                params={
                    "api-version": self.API_VERSION,
                    "ids": ",".join(ids),
                    "fields": "System.Id,System.Title,System.WorkItemType,System.State",
                },
                allow_redirects=False,
            )
            if batch_response.status_code != 200:
                return {
                    'success': False,
                    'message': f'Failed to load matched work items: {self.get_error_message(batch_response.status_code)}',
                    'work_items': [],
                }

            work_items = []
            for item in batch_response.json().get('value', []):
                fields = item.get('fields', {})
                work_items.append({
                    'id': str(item.get('id')),
                    'title': fields.get('System.Title'),
                    'work_item_type': fields.get('System.WorkItemType'),
                    'state': fields.get('System.State'),
                })
            return {'success': True, 'work_items': work_items}
        except Exception as e:
            return {'success': False, 'message': str(e), 'work_items': []}

    def list_active_bugs(self, limit: int = 500) -> Dict[str, Any]:
        """List Bug work items that are not Closed/Removed, for the periodic import job.

        Re-run in full on every poll cycle rather than incrementally: it doubles
        as both the initial backfill (every not-closed bug already in the
        project shows up on the first run) and the ongoing sync (a bug that
        moves out of this set has changed state since the last cycle).
        """
        try:
            wiql = {
                "query": (
                    "SELECT [System.Id] FROM WorkItems "
                    "WHERE [System.TeamProject] = @project "
                    "AND [System.WorkItemType] = 'Bug' "
                    "AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' "
                    "ORDER BY [System.ChangedDate] DESC"
                )
            }
            wiql_response = self._make_request(
                'POST',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/wiql",
                headers=self.headers,
                params={"api-version": self.API_VERSION, "$top": limit},
                allow_redirects=False,
                json=wiql,
            )
            if wiql_response.status_code != 200:
                return {
                    'success': False,
                    'message': f'Query failed: {self.get_error_message(wiql_response.status_code)}',
                    'work_items': [],
                }

            ids = [str(item['id']) for item in wiql_response.json().get('workItems', [])][:limit]
            if not ids:
                return {'success': True, 'work_items': []}

            fields = (
                "System.Id,System.Title,System.Description,System.State,"
                "System.CreatedDate,System.ChangedDate,Microsoft.VSTS.Common.Severity"
            )
            batch_response = self._make_request(
                'GET',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitems",
                headers=self.headers,
                params={"api-version": self.API_VERSION, "ids": ",".join(ids), "fields": fields},
                allow_redirects=False,
            )
            if batch_response.status_code != 200:
                return {
                    'success': False,
                    'message': f'Failed to load bugs: {self.get_error_message(batch_response.status_code)}',
                    'work_items': [],
                }

            work_items = []
            for item in batch_response.json().get('value', []):
                item_fields = item.get('fields', {})
                work_items.append({
                    'id': str(item.get('id')),
                    'title': item_fields.get('System.Title'),
                    'description': item_fields.get('System.Description'),
                    'state': item_fields.get('System.State'),
                    'severity': item_fields.get('Microsoft.VSTS.Common.Severity'),
                    'created_date': item_fields.get('System.CreatedDate'),
                    'changed_date': item_fields.get('System.ChangedDate'),
                    'url': f"{self.api_url}/{self.organization}/{self.project}/_workitems/edit/{item.get('id')}",
                })
            return {'success': True, 'work_items': work_items}
        except Exception as e:
            return {'success': False, 'message': str(e), 'work_items': []}

    def create_work_item(self, title: str, description: str, work_item_type: str = 'Bug',
                        priority: str = '2', assignee: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new work item in Azure DevOps.
        
        Args:
            title: Work item title
            description: Work item description
            work_item_type: Work item type (Bug, Task, Issue, etc.)
            priority: Priority (1-3, where 1 is highest)
            assignee: Assignee email or ID
            
        Returns:
            Dict with work item data or error
        """
        try:
            # Get work item type reference
            type_response = self._make_request(
                'GET',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitemtypes/{work_item_type}",
                headers=self.headers,
                params={"api-version": self.API_VERSION},
                allow_redirects=False,
            )
            
            if type_response.status_code != 200:
                return {
                    'success': False,
                    'message': f'Failed to get work item type: {type_response.status_code}'
                }

            # Create work item
            payload = [
                {
                    "op": "add",
                    "path": "/fields/System.Title",
                    "value": title
                },
                {
                    "op": "add",
                    "path": "/fields/System.Description",
                    "value": description
                },
                {
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.Common.Priority",
                    "value": int(priority)
                }
            ]
            
            if assignee:
                payload.append({
                    "op": "add",
                    "path": "/fields/System.AssignedTo",
                    "value": assignee
                })
            
            # Azure DevOps work-item create/update use a JSON Patch document and
            # require the json-patch media type; plain application/json returns 415.
            patch_headers = dict(self.headers)
            patch_headers['Content-Type'] = 'application/json-patch+json'

            response = self._make_request(
                'POST',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitems/${work_item_type}",
                headers=patch_headers,
                params={"api-version": self.API_VERSION},
                allow_redirects=False,
                json=payload
            )

            if response.status_code == 200:
                work_item = response.json()
                return {
                    'success': True,
                    'work_item_id': str(work_item.get('id')),
                    'work_item_url': f"{self.api_url}/{self.organization}/{self.project}/_workitems/edit/{work_item.get('id')}",
                    'work_item': work_item
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to create work item: {response.status_code} - {response.text}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error creating work item: {str(e)}'
            }
    
    def update_work_item(self, work_item_id: str, title: Optional[str] = None, 
                        description: Optional[str] = None, priority: Optional[str] = None) -> Dict[str, Any]:
        """
        Update an existing work item in Azure DevOps.
        
        Args:
            work_item_id: Work item ID
            title: New title (optional)
            description: New description (optional)
            priority: New priority (optional)
            
        Returns:
            Dict with work item data or error
        """
        try:
            payload = []
            
            if title:
                payload.append({
                    "op": "add",
                    "path": "/fields/System.Title",
                    "value": title
                })
            
            if description:
                payload.append({
                    "op": "add",
                    "path": "/fields/System.Description",
                    "value": description
                })
            
            if priority:
                payload.append({
                    "op": "add",
                    "path": "/fields/Microsoft.VSTS.Common.Priority",
                    "value": int(priority)
                })

            if not payload:
                return {
                    'success': False,
                    'message': 'No fields provided to update'
                }

            # JSON Patch document requires the json-patch media type.
            patch_headers = dict(self.headers)
            patch_headers['Content-Type'] = 'application/json-patch+json'

            response = self._make_request(
                'PATCH',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitems/{work_item_id}",
                headers=patch_headers,
                params={"api-version": self.API_VERSION},
                allow_redirects=False,
                json=payload
            )
            
            if response.status_code == 200:
                work_item = response.json()
                return {
                    'success': True,
                    'work_item': work_item
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to update work item: {response.status_code} - {response.text}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error updating work item: {str(e)}'
            }
    
    def get_work_item(self, work_item_id: str) -> Dict[str, Any]:
        """
        Get a work item from Azure DevOps.
        
        Args:
            work_item_id: Work item ID
            
        Returns:
            Dict with work item data or error
        """
        try:
            response = self._make_request(
                'GET',
                f"{self.api_url}/{self.organization}/{self.project}/_apis/wit/workitems/{work_item_id}",
                headers=self.headers,
                params={"api-version": self.API_VERSION},
                allow_redirects=False,
            )
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'work_item': response.json()
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to get work item: {response.status_code}'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error getting work item: {str(e)}'
            }
