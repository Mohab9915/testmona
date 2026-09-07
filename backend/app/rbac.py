import re
from functools import wraps
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from .models import User, Role, Project, ProjectAssignment
from typing import List, Optional, Pattern, Tuple


PROJECT_PERMISSION_ALIASES = {
    "view": "read",
}


# HTTP methods that never mutate state — always allowed for any authenticated user.
SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


def _m_re(method: str, pattern: str) -> Tuple[str, Pattern]:
    return (method.upper(), re.compile(pattern))


# Self-service writes a read-only ``viewer`` is still allowed to perform. Matched with
# ``re.search`` against ``request.url.path`` so an optional reverse-proxy "/api" prefix
# does not break matching. Anything not listed here is blocked for viewers.
_VIEWER_WRITE_ALLOWLIST: List[Tuple[str, Pattern]] = [
    # account & session
    _m_re("POST", r"/(token|refresh|logout)$"),
    _m_re("POST", r"/users/me/change-password$"),
    _m_re("POST", r"/users/me/2fa/(setup|enable|disable|recovery-codes)$"),
    _m_re("POST", r"/users/me/avatar$"),
    _m_re("PUT", r"/users/me$"),
    _m_re("PUT", r"/users/me/notification-preferences$"),
    _m_re("PUT", r"/users/me/onboarding-checklist/.+$"),
    # own notifications
    _m_re("PUT", r"/notifications/\d+(/mark-unread)?$"),
    _m_re("POST", r"/notifications/mark-all-read$"),
    _m_re("POST", r"/notifications/bulk-update$"),
    _m_re("DELETE", r"/notifications/(all|cleanup|bulk-delete|\d+)$"),
    # personal saved views / searches
    _m_re("POST", r"/saved-filters$"),
    _m_re("PUT", r"/saved-filters/\d+$"),
    _m_re("DELETE", r"/saved-filters/\d+$"),
    _m_re("POST", r"/advanced-search/saved$"),
]


def has_elevated_project_membership(user: object, db: Optional[Session]) -> bool:
    """True if a global ``viewer`` has been elevated above read-only in any project.

    A project manager can assign a higher role (tester/manager/…) to a globally
    read-only user, or that user may own a project. In either case the user can
    legitimately write *within those projects*, so they are no longer purely
    read-only. The per-project decision is still made by ``has_permission``; this
    only answers "is this user elevated *somewhere*" so the blanket viewer gate
    can step aside and defer to those project-scoped checks.
    """
    if db is None:
        return False

    user_id = getattr(user, "id", None)
    if user_id is None:
        return False

    assignments = db.query(ProjectAssignment).filter(
        ProjectAssignment.user_id == user_id
    ).all()
    for assignment in assignments:
        assignment_role = normalize_role(assignment.role)
        if assignment_role is None:
            continue
        # Any project permission beyond plain "read" counts as elevation.
        if ROLE_PERMISSIONS.get(assignment_role, set()) - {"read"}:
            return True

    # Project owners can write within the projects they own (see ``has_permission``).
    owns_project = db.query(Project).filter(Project.owner_id == user_id).first()
    return owns_project is not None


def enforce_viewer_read_only(
    user: object, method: str, path: str, db: Optional[Session] = None
) -> None:
    """Global read-only gate for the ``viewer`` role.

    No-op for superusers and any non-viewer role; viewers may issue safe (read) methods
    and the self-service writes in ``_VIEWER_WRITE_ALLOWLIST``. Everything else raises 403.
    This is defense-in-depth on top of the per-route ``has_permission`` checks: it covers
    every authenticated route because every one resolves through ``auth.get_current_user``.

    A globally-read-only user who has been elevated in a project (assigned a higher
    role by a project manager, or owning the project) is *not* blanket-blocked here:
    the gate steps aside and lets the per-route, project-scoped ``has_permission``
    checks decide, so they can write in the project(s) where they were elevated while
    staying read-only everywhere else.
    """
    if getattr(user, "is_superuser", False):
        return
    if normalize_role(getattr(user, "role", None)) != Role.VIEWER:
        return
    if method.upper() in SAFE_METHODS:
        return
    for allowed_method, pattern in _VIEWER_WRITE_ALLOWLIST:
        if allowed_method == method.upper() and pattern.search(path):
            return
    if has_elevated_project_membership(user, db):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Viewer role is read-only",
    )


ROLE_PERMISSIONS = {
    Role.ADMIN: {"read", "write", "delete", "execute", "manage_users", "manage_projects"},
    Role.MANAGER: {"read", "write", "delete", "execute", "manage_projects"},
    # Testers can execute test runs, log results, and file/update defects (all
    # gated on "execute" at the relevant routes) — but not author or delete
    # test suites/cases/plans/requirements/milestones/etc. (gated on "write"),
    # which stays Manager/Admin only.
    Role.TESTER: {"read", "execute"},
    Role.VIEWER: {"read"},
}


def normalize_permission(permission: str) -> str:
    normalized = permission.strip().lower()
    return PROJECT_PERMISSION_ALIASES.get(normalized, normalized)


def normalize_role(role: object) -> Optional[Role]:
    """Normalize DB strings, enum names, and enum values to a Role enum."""
    if isinstance(role, Role):
        return role
    if not isinstance(role, str):
        return None

    normalized = role.strip().lower()
    for candidate in Role:
        if normalized in {candidate.value.lower(), candidate.name.lower()}:
            return candidate
    return None


def role_value(role: object, default: Role = Role.TESTER) -> str:
    normalized_role = normalize_role(role)
    return (normalized_role or default).value


def is_role(user: User, role: Role) -> bool:
    return normalize_role(getattr(user, "role", None)) == role


def has_global_permission(user: User, permission: str) -> bool:
    if getattr(user, "is_superuser", False):
        return True
    normalized_role = normalize_role(getattr(user, "role", None))
    if not normalized_role:
        return False
    return normalize_permission(permission) in ROLE_PERMISSIONS.get(normalized_role, set())


def has_permission(user: User, permission: str, project_id: int = None, db: Session = None) -> bool:
    """Check if user has required permission"""
    permission = normalize_permission(permission)
    
    # Superusers have all permissions
    if getattr(user, "is_superuser", False):
        return True

    normalized_role = normalize_role(getattr(user, "role", None))
    global_permissions = ROLE_PERMISSIONS.get(normalized_role, set())
    
    # Non-project permissions use the user's global role only.
    if project_id is None:
        return permission in global_permissions
    
    if db is None:
        return False

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return False

    # Global admin/manager permissions apply to all projects.
    if normalized_role in {Role.ADMIN, Role.MANAGER} and permission in global_permissions:
        return True

    # Project owners can manage their own project, but not global user admin.
    if project.owner_id == user.id and permission != "manage_users":
        return True

    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.user_id == user.id,
        ProjectAssignment.project_id == project_id
    ).first()

    if not assignment:
        return False

    assignment_role = normalize_role(assignment.role)
    assignment_permissions = ROLE_PERMISSIONS.get(assignment_role, set())
    return permission in assignment_permissions


def can(user: User, permission: str, project_id: int = None, db: Session = None) -> bool:
    """Public capability check — thin alias for :func:`has_permission`.

    Use this from route serializers to populate ``can_edit``/``can_delete``
    capability flags on responses (the pattern Doc Hub established), so the
    frontend can gate controls on exactly what the backend will allow.
    """
    return has_permission(user, permission, project_id, db)


def can_execute_test_run(user: User, test_run: object, db: Session = None) -> bool:
    """Whether ``user`` may record execution work against ``test_run``.

    Execution is *assignment-scoped*. A role that can only ``execute`` (tester)
    works exclusively on the runs assigned to it: it may not log results into a
    colleague's run, nor pick up an unassigned one. Roles that can author runs in
    the project (admin/manager/project owner — anything holding ``write``) own the
    plan the run belongs to, so they stay unrestricted.

    ``test_run`` is any object exposing ``project_id`` and ``assigned_to``.
    """
    project_id = getattr(test_run, "project_id", None)
    if project_id is None:
        return False
    if not has_permission(user, "execute", project_id, db):
        return False
    # Whoever may author runs in the project may execute any of them.
    if has_permission(user, "write", project_id, db):
        return True
    assigned_to = getattr(test_run, "assigned_to", None)
    return assigned_to is not None and assigned_to == getattr(user, "id", None)


def require_test_run_execution(
    user: User, test_run: object, db: Session = None, action: str = "execute"
) -> None:
    """Raise 403 unless ``user`` may :func:`can_execute_test_run` ``test_run``.

    The two failure modes are split so the caller sees *why*: no execute rights in
    the project at all, versus execute rights but somebody else's run.
    """
    if can_execute_test_run(user, test_run, db):
        return

    project_id = getattr(test_run, "project_id", None)
    if project_id is not None and has_permission(user, "execute", project_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This test run is not assigned to you",
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Not authorized to {action} this test run",
    )


def can_view_test_run(user: User, test_run: object, db: Session = None) -> bool:
    """Whether ``test_run`` should appear in ``user``'s browse list of runs.

    Authoring roles (``write``) and plain read-only roles (viewer: ``read`` but not
    ``execute``) see every run in a project they can read. Execute-only roles
    (tester) only see the runs assigned to them in the browse list — the same
    scoping :func:`can_execute_test_run` applies to what they may act on.

    This intentionally does *not* gate opening a run by ID: other features (defect
    detail, milestone rollups, dashboards, the traceability matrix) resolve a run
    regardless of its assignee, and execution itself is separately enforced by
    :func:`require_test_run_execution`. Only the list endpoint applies this filter.
    """
    project_id = getattr(test_run, "project_id", None)
    if project_id is None:
        return False
    if has_permission(user, "write", project_id, db):
        return True
    if has_permission(user, "execute", project_id, db):
        assigned_to = getattr(test_run, "assigned_to", None)
        return assigned_to is not None and assigned_to == getattr(user, "id", None)
    return has_permission(user, "read", project_id, db)


# Every distinct permission known to the RBAC table — the universe to probe when
# computing a user's effective set for the frontend.
ALL_PERMISSIONS = frozenset().union(*ROLE_PERMISSIONS.values())


def effective_permissions(user: User, db: Session) -> dict:
    """Return the user's effective permission sets for the frontend.

    Shape: ``{"global": [...perms], "projects": {<project_id>: [...perms]}}``.
    ``global`` is the blanket (project-independent) set. ``projects`` lists *only*
    the projects whose effective permissions differ from ``global`` — e.g. a
    project a tester *owns* (ownership grants manage_projects) or a globally
    read-only viewer elevated in one project. For any project not present the
    client falls back to ``global``. This keeps the payload small for
    admins/managers (uniform across every project) while still surfacing elevation.

    Both sets are derived from :func:`has_permission` itself, so this endpoint can
    never diverge from what the routes actually enforce (incl. owner elevation).
    """
    global_perms = {p for p in ALL_PERMISSIONS if has_permission(user, p)}

    projects: dict = {}
    # Admins/managers/superusers have uniform (== global) perms across every
    # project, so there is nothing project-specific to enumerate.
    is_superuser = bool(getattr(user, "is_superuser", False))
    if not is_superuser and normalize_role(getattr(user, "role", None)) not in {Role.ADMIN, Role.MANAGER}:
        for entry in get_user_projects(user, db):
            project_id = entry["project"].id
            perms = {p for p in ALL_PERMISSIONS if has_permission(user, p, project_id, db)}
            if perms != global_perms:
                projects[project_id] = sorted(perms)

    return {"global": sorted(global_perms), "projects": projects}


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
    if getattr(user, "is_superuser", False) or is_role(user, Role.ADMIN) or is_role(user, Role.MANAGER):
        return db.query(Project).all()
    
    # Get projects through assignments and ownership.
    assignments = db.query(ProjectAssignment).filter(
        ProjectAssignment.user_id == user.id
    ).all()
    
    project_ids = [assignment.project_id for assignment in assignments]
    return db.query(Project).filter(
        or_(Project.owner_id == user.id, Project.id.in_(project_ids))
    ).all()


def can_manage_project(user: User, project_id: int, db: Session) -> bool:
    """Check if user can manage a specific project"""
    return has_permission(user, "manage_projects", project_id, db)


def can_assign_users(user: User, project_id: int, db: Session) -> bool:
    """Check if user can assign other users to a project"""
    return can_manage_project(user, project_id, db)


def get_user_projects(user: User, db: Session):
    """Get projects with user's role in each project"""
    if getattr(user, "is_superuser", False) or is_role(user, Role.ADMIN) or is_role(user, Role.MANAGER):
        projects = db.query(Project).all()
        return [
            {"project": p, "role": role_value(getattr(user, "role", None), Role.ADMIN), "assigned_at": None}
            for p in projects
        ]

    assignments = db.query(ProjectAssignment).filter(
        ProjectAssignment.user_id == user.id
    ).all()

    result = []
    seen_project_ids = set()
    for project in db.query(Project).filter(Project.owner_id == user.id).all():
        result.append({
            "project": project,
            "role": role_value(getattr(user, "role", None), Role.MANAGER),
            "assigned_at": None
        })
        seen_project_ids.add(project.id)

    for assignment in assignments:
        if assignment.project_id in seen_project_ids:
            continue
        project = db.query(Project).filter(
            Project.id == assignment.project_id
        ).first()
        if project:
            result.append({
                "project": project,
                "role": role_value(assignment.role),
                "assigned_at": assignment.assigned_at
            })

    return result
