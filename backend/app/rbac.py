from functools import wraps
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Role, Project, ProjectAssignment
from .auth import get_current_user
from typing import List


def has_permission(user: User, permission: str, project_id: int = None, db: Session = None) -> bool:
    """Check if user has required permission"""
    
    # Superusers have all permissions
    if user.is_superuser:
        return True
    
    # Define role permissions
    role_permissions = {
        Role.ADMIN: [
            "read", "write", "delete", "execute", 
            "manage_users", "manage_projects"
        ],
        Role.MANAGER: [
            "read", "write", "delete", "execute", "manage_projects"
        ],
        Role.TESTER: [
            "read", "write", "execute"
        ],
        Role.VIEWER: [
            "read"
        ]
    }
    
    # Handle both enum and string role values
    if isinstance(user.role, str):
        # Convert string role to enum
        role_enum = None
        for role in Role:
            if role.value == user.role:
                role_enum = role
                break
        user_permissions = role_permissions.get(role_enum, [])
    else:
        user_permissions = role_permissions.get(user.role, [])
    
    # Check basic permission
    if permission not in user_permissions:
        return False
    
    # If project-specific permission is required, check project access
    if project_id is not None:
        if db is None:
            # If no db session provided, skip project-specific checks
            # This is a safe fallback - we require db for proper permission checks
            return False
        
        # Check if user is project owner
        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.owner_id == user.id:
            return True
        
        # Check project assignment
        assignment = db.query(ProjectAssignment).filter(
            ProjectAssignment.user_id == user.id,
            ProjectAssignment.project_id == project_id
        ).first()
        
        if not assignment:
            return False
        
        # Check if user has sufficient role in the project
        if permission == "delete" and assignment.role not in [Role.ADMIN, Role.MANAGER]:
            return False
        if permission == "execute" and assignment.role not in [Role.ADMIN, Role.MANAGER, Role.TESTER]:
            return False
        
        return True
    
    return True


def require_permission(permission: str, project_id_param: str = None):
    """Decorator to require specific permission"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            project_id = None
            if project_id_param:
                project_id = kwargs.get(project_id_param)
            db = kwargs.get("db")
            
            if not has_permission(current_user, permission, project_id, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {permission}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def get_accessible_projects(user: User, db: Session) -> List[Project]:
    """Get projects that user has access to"""
    if user.is_superuser:
        return db.query(Project).all()
    
    # Get projects through assignments
    assignments = db.query(ProjectAssignment).filter(
        ProjectAssignment.user_id == user.id
    ).all()
    
    project_ids = [assignment.project_id for assignment in assignments]
    return db.query(Project).filter(Project.id.in_(project_ids)).all()


def can_manage_project(user: User, project_id: int, db: Session) -> bool:
    """Check if user can manage a specific project"""
    if user.is_superuser:
        return True
    
    # Check if user is the owner
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.owner_id == user.id:
        return True
    
    # Check assignment with admin/manager role
    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.user_id == user.id,
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.role.in_([Role.ADMIN, Role.MANAGER])
    ).first()
    
    return assignment is not None


def can_assign_users(user: User, project_id: int, db: Session) -> bool:
    """Check if user can assign other users to a project"""
    if user.is_superuser:
        return True
    
    # Only admins and managers can assign users
    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.user_id == user.id,
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.role.in_([Role.ADMIN, Role.MANAGER])
    ).first()
    
    return assignment is not None


def get_user_projects(user: User, db: Session):
    """Get projects with user's role in each project"""
    if user.is_superuser:
        projects = db.query(Project).all()
        return [{"project": p, "role": Role.ADMIN} for p in projects]
    
    assignments = db.query(ProjectAssignment).filter(
        ProjectAssignment.user_id == user.id
    ).all()
    
    result = []
    for assignment in assignments:
        project = db.query(Project).filter(
            Project.id == assignment.project_id
        ).first()
        if project:
            result.append({
                "project": project,
                "role": assignment.role,
                "assigned_at": assignment.assigned_at
            })
    
    return result
