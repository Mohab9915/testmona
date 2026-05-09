from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.versioning_service import VersioningService
from ..services.auth_service import get_current_user
from ..services.rbac_service import RBACService
from ..schemas import (
    TestCaseVersionCreate, TestCaseVersionUpdate
)

router = APIRouter(prefix="/versioning", tags=["versioning"])


def get_versioning_service(db: Session = Depends(get_db)) -> VersioningService:
    return VersioningService(db)


@router.post("/test-cases/{test_case_id}/versions", response_model=TestCaseVersionResponse)
def create_version(
    test_case_id: int,
    version_data: TestCaseVersionCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Create a new version of a test case"""
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", test_case_id):
        raise HTTPException(status_code=403, detail="No permission to create version")
    
    try:
        version = versioning_service.create_version(
            test_case_id=test_case_id,
            version_data=version_data,
            created_by=current_user["id"]
        )
        return version
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/test-cases/{test_case_id}/versions", response_model=List[TestCaseVersionResponse])
def get_versions(
    test_case_id: int,
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Get all versions of a test case"""
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "read", test_case_id):
        raise HTTPException(status_code=403, detail="No permission to read versions")
    
    versions = versioning_service.get_versions(test_case_id)
    
    # Filter by status if provided
    if status:
        versions = [v for v in versions if v.status.value == status]
    
    return versions


@router.get("/test-cases/{test_case_id}/versions/latest", response_model=Optional[TestCaseVersionResponse])
def get_latest_version(
    test_case_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Get the latest published version of a test case"""
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "read", test_case_id):
        raise HTTPException(status_code=403, detail="No permission to read versions")
    
    return versioning_service.get_latest_version(test_case_id)


@router.get("/versions/{version_id}", response_model=TestCaseVersionResponse)
def get_version(
    version_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Get a specific version"""
    version = versioning_service.get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "read", version.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to read version")
    
    return version


@router.put("/versions/{version_id}", response_model=TestCaseVersionResponse)
def update_version(
    version_id: int,
    update_data: TestCaseVersionUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Update a version (only draft versions can be updated)"""
    version = versioning_service.get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", version.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to update version")
    
    try:
        return versioning_service.update_version(
            version_id=version_id,
            update_data=update_data,
            updated_by=current_user["id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/versions/{version_id}/publish", response_model=TestCaseVersionResponse)
def publish_version(
    version_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Publish a version"""
    version = versioning_service.get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", version.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to publish version")
    
    try:
        return versioning_service.publish_version(
            version_id=version_id,
            published_by=current_user["id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test-cases/{test_case_id}/rollback", response_model=TestCaseVersionResponse)
def rollback_to_version(
    test_case_id: int,
    rollback_data: VersionRollbackRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Rollback a test case to a specific version"""
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", test_case_id):
        raise HTTPException(status_code=403, detail="No permission to rollback test case")
    
    try:
        return versioning_service.rollback_to_version(
            test_case_id=test_case_id,
            target_version_id=rollback_data.target_version_id,
            rollback_by=current_user["id"],
            reason=rollback_data.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/versions/compare", response_model=VersionComparisonResponse)
def compare_versions(
    compare_data: VersionCompareRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Compare two versions"""
    # Get versions to check permissions
    from_version = versioning_service.get_version(compare_data.from_version_id)
    to_version = versioning_service.get_version(compare_data.to_version_id)
    
    if not from_version or not to_version:
        raise HTTPException(status_code=404, detail="One or both versions not found")
    
    # Check permissions for both versions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "read", from_version.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to read from version")
    
    if not rbac.check_permission(current_user["id"], "read", to_version.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to read to version")
    
    try:
        return versioning_service.compare_versions(
            from_version_id=compare_data.from_version_id,
            to_version_id=compare_data.to_version_id,
            created_by=current_user["id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/versions/branch", response_model=TestCaseVersionResponse)
def create_branch(
    branch_data: VersionBranchRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Create a branch from a specific version"""
    parent_version = versioning_service.get_version(branch_data.parent_version_id)
    if not parent_version:
        raise HTTPException(status_code=404, detail="Parent version not found")
    
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", parent_version.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to create branch")
    
    try:
        return versioning_service.create_branch(
            parent_version_id=branch_data.parent_version_id,
            branch_name=branch_data.branch_name,
            created_by=current_user["id"],
            reason=branch_data.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/versions/merge", response_model=TestCaseVersionResponse)
def merge_branch(
    merge_data: VersionMergeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Merge a branch into another version"""
    branch_version = versioning_service.get_version(merge_data.branch_version_id)
    if not branch_version:
        raise HTTPException(status_code=404, detail="Branch version not found")
    
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", branch_version.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to merge branch")
    
    try:
        return versioning_service.merge_branch(
            branch_version_id=merge_data.branch_version_id,
            target_version_id=merge_data.target_version_id,
            merged_by=current_user["id"],
            merge_reason=merge_data.merge_reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/lock", response_model=VersionLockResponse)
def lock_version(
    lock_data: VersionLockRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Lock a test case or specific version"""
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", lock_data.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to lock test case")
    
    try:
        return versioning_service.lock_version(
            test_case_id=lock_data.test_case_id,
            version_id=lock_data.version_id,
            lock_type=lock_data.lock_type,
            locked_by=current_user["id"],
            reason=lock_data.reason,
            expires_hours=lock_data.expires_hours
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/lock/{test_case_id}")
def release_locks(
    test_case_id: int,
    version_id: Optional[int] = Query(None, description="Specific version to unlock"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Release locks for a test case or version"""
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", test_case_id):
        raise HTTPException(status_code=403, detail="No permission to release locks")
    
    versioning_service.release_locks(test_case_id, version_id)
    return {"message": "Locks released successfully"}


@router.post("/tags", response_model=VersionTagResponse)
def add_tag(
    tag_data: VersionTagRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Add a tag to a version"""
    version = versioning_service.get_version(tag_data.version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "write", version.test_case_id):
        raise HTTPException(status_code=403, detail="No permission to add tag")
    
    try:
        return versioning_service.add_tag(
            version_id=tag_data.version_id,
            tag_name=tag_data.tag_name,
            tag_type=tag_data.tag_type,
            description=tag_data.description,
            created_by=current_user["id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/test-cases/{test_case_id}/history", response_model=VersionHistoryResponse)
def get_version_history(
    test_case_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Get complete version history for a test case"""
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "read", test_case_id):
        raise HTTPException(status_code=403, detail="No permission to read version history")
    
    versions = versioning_service.get_versions(test_case_id)
    current_version = versioning_service.get_latest_version(test_case_id)
    
    draft_versions = [v for v in versions if v.status.value == "draft"]
    published_versions = [v for v in versions if v.status.value == "published"]
    branches = [v for v in versions if v.branch_name is not None]
    
    # Get tags for all versions
    from ..models_versioning import VersionTag
    tags = db.query(VersionTag).filter(
        VersionTag.version_id.in_([v.id for v in versions])
    ).all()
    
    return VersionHistoryResponse(
        test_case_id=test_case_id,
        current_version=current_version,
        versions=versions,
        total_versions=len(versions),
        draft_versions=draft_versions,
        published_versions=published_versions,
        branches=branches,
        tags=tags
    )


@router.get("/test-cases/{test_case_id}/stats", response_model=VersionStatsResponse)
def get_version_stats(
    test_case_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Get version statistics for a test case"""
    # Check permissions
    rbac = RBACService(db)
    if not rbac.check_permission(current_user["id"], "read", test_case_id):
        raise HTTPException(status_code=403, detail="No permission to read version stats")
    
    versions = versioning_service.get_versions(test_case_id)
    current_version = versioning_service.get_latest_version(test_case_id)
    
    draft_versions = [v for v in versions if v.status.value == "draft"]
    published_versions = [v for v in versions if v.status.value == "published"]
    branches = [v for v in versions if v.branch_name is not None]
    
    # Get tags count
    from ..models_versioning import VersionTag
    tags_count = db.query(VersionTag).filter(
        VersionTag.version_id.in_([v.id for v in versions])
    ).count()
    
    last_updated = versions[0].created_at if versions else None
    
    return VersionStatsResponse(
        test_case_id=test_case_id,
        total_versions=len(versions),
        published_versions=len(published_versions),
        draft_versions=len(draft_versions),
        branches=len(branches),
        tags=tags_count,
        last_updated=last_updated,
        current_version=current_version.version_string if current_version else None
    )


@router.post("/bulk-operation", response_model=BulkVersionResponse)
def bulk_version_operation(
    operation_data: BulkVersionOperation,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    versioning_service: VersioningService = Depends(get_versioning_service)
):
    """Perform bulk operations on multiple test cases"""
    successful = []
    failed = []
    
    for test_case_id in operation_data.test_case_ids:
        try:
            # Check permissions for each test case
            rbac = RBACService(db)
            if not rbac.check_permission(current_user["id"], "write", test_case_id):
                failed.append({
                    "test_case_id": test_case_id,
                    "error": "No permission"
                })
                continue
            
            # Perform operation based on type
            if operation_data.operation == "publish":
                version_id = operation_data.parameters.get("version_id")
                if version_id:
                    versioning_service.publish_version(version_id, current_user["id"])
                    successful.append(test_case_id)
                else:
                    failed.append({
                        "test_case_id": test_case_id,
                        "error": "Missing version_id for publish operation"
                    })
            
            elif operation_data.operation == "rollback":
                target_version_id = operation_data.parameters.get("target_version_id")
                reason = operation_data.parameters.get("reason", "Bulk rollback")
                if target_version_id:
                    versioning_service.rollback_to_version(
                        test_case_id, target_version_id, current_user["id"], reason
                    )
                    successful.append(test_case_id)
                else:
                    failed.append({
                        "test_case_id": test_case_id,
                        "error": "Missing target_version_id for rollback operation"
                    })
            
            elif operation_data.operation == "lock":
                lock_type = operation_data.parameters.get("lock_type", "edit")
                reason = operation_data.parameters.get("reason", "Bulk lock")
                versioning_service.lock_version(
                    test_case_id, None, lock_type, current_user["id"], reason
                )
                successful.append(test_case_id)
            
            else:
                failed.append({
                    "test_case_id": test_case_id,
                    "error": f"Unsupported operation: {operation_data.operation}"
                })
        
        except Exception as e:
            failed.append({
                "test_case_id": test_case_id,
                "error": str(e)
            })
    
    return BulkVersionResponse(
        successful=successful,
        failed=failed,
        total_processed=len(operation_data.test_case_ids)
    )
