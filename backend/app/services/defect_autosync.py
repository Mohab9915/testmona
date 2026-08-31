"""Push a newly created defect to any issue tracker configured to auto-sync.

Manual syncing goes through
``POST /projects/{id}/defects-management/{defect_id}/sync-with-external``. This
module is the automatic counterpart: it runs on defect creation for every active
integration whose ``sync_config.auto_sync_on_create`` is set.

Two rules govern everything here:

* **A tracker failure must never fail the defect.** The defect is already
  committed by the time this runs; a broken PAT or an unreachable tracker is
  recorded on the row (``external_sync_status``) and logged, not raised.
* **Only a successful push records a link.** Writing ``external_issue_id``
  unconditionally would wipe a real link and claim a sync that never happened.
"""
import logging
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from .. import models

logger = logging.getLogger(__name__)


def _plain(value: Any) -> Any:
    """Enum -> its value. The tracker mappers treat these fields as strings."""
    return getattr(value, "value", value)


def build_defect_payload(db: Session, defect: models.Defect) -> Dict[str, Any]:
    """The dict shape ``SyncService.sync_defect_to_external`` expects."""
    from .. import crud

    setting = crud.get_system_setting(db, key="app_name")
    app_name = setting.value.strip() if setting and setting.value else "TestMona"

    return {
        "defect_id": defect.defect_id,
        "app_name": app_name,
        "title": defect.title,
        "description": defect.description,
        "severity": _plain(defect.severity),
        "priority": _plain(defect.priority),
        "status": _plain(defect.status),
        "steps_to_reproduce": defect.steps_to_reproduce,
        "expected_result": defect.expected_result,
        "actual_result": defect.actual_result,
        "environment": defect.environment,
        "browser_info": defect.browser_info,
        "root_cause": defect.root_cause,
        "tags": defect.tags,
        "external_issue_id": defect.external_issue_id,
        "external_issue_url": defect.external_issue_url,
    }


def _integration_payload(integration: models.IssueTrackerIntegration) -> Dict[str, Any]:
    return {
        "id": integration.id,
        "tracker_type": integration.tracker_type,
        "api_url": integration.api_url,
        "api_token": integration.api_token,
        "project_key": integration.project_key,
        "name": integration.name,
        "sync_config": integration.sync_config or {},
    }


def auto_sync_integrations(
    db: Session, project_id: int
) -> List[models.IssueTrackerIntegration]:
    """Active integrations for a project that opted into sync-on-create."""
    integrations = (
        db.query(models.IssueTrackerIntegration)
        .filter(
            models.IssueTrackerIntegration.project_id == project_id,
            models.IssueTrackerIntegration.is_active.is_(True),
        )
        .all()
    )
    return [
        integration
        for integration in integrations
        if bool((integration.sync_config or {}).get("auto_sync_on_create"))
    ]


def auto_sync_new_defect(db: Session, defect: models.Defect) -> Optional[Dict[str, Any]]:
    """Push a just-created defect to the first auto-sync integration.

    Returns the sync result, or None when nothing was configured. Never raises:
    a tracker being down must not turn a successful defect creation into a 500.
    """
    if defect is None or defect.external_issue_id:
        return None

    try:
        integrations = auto_sync_integrations(db, defect.project_id)
    except Exception:
        logger.exception("auto-sync: failed to look up integrations for project %s", defect.project_id)
        return None

    if not integrations:
        return None

    # One tracker is the sensible target: a defect has a single external_issue_id,
    # so pushing to several would leave all but one link unrecorded.
    integration = integrations[0]
    if len(integrations) > 1:
        logger.warning(
            "auto-sync: %d integrations opted in for project %s; using %r",
            len(integrations), defect.project_id, integration.name,
        )

    try:
        from ..sync_service import SyncService

        result = SyncService.sync_defect_to_external(
            build_defect_payload(db, defect),
            _integration_payload(integration),
            action="create",
        )
    except Exception as e:
        logger.exception("auto-sync: %s push failed for defect %s", integration.tracker_type, defect.defect_id)
        _record_failure(db, defect, str(e))
        return {"success": False, "message": str(e)}

    if result.get("success"):
        defect.external_issue_id = result.get("issue_id")
        defect.external_issue_url = result.get("issue_url")
        defect.external_sync_status = "synced"
        defect.external_last_sync = datetime.now(UTC)
        logger.info(
            "auto-sync: defect %s -> %s issue %s",
            defect.defect_id, integration.tracker_type, result.get("issue_id"),
        )
    else:
        _record_failure(db, defect, result.get("message") or "Sync failed")
        logger.warning(
            "auto-sync: defect %s not pushed to %s: %s",
            defect.defect_id, integration.tracker_type, result.get("message"),
        )

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("auto-sync: could not persist sync outcome for defect %s", defect.defect_id)

    return result


def sync_ado_parent_link(db: Session, defect: models.Defect, parent_changed: bool) -> None:
    """Best-effort: push defect.ado_parent_work_item_id to Azure DevOps as the
    work item's hierarchical parent, once the defect itself has been synced.

    ``parent_changed`` distinguishes "this request touched the field" from
    "the field happens to have a value" - an update that doesn't mention the
    parent at all must not re-push it on every unrelated edit. Same
    never-raise philosophy as auto_sync_new_defect: a bad parent id or an
    unreachable tracker must not fail the defect save it's attached to.
    """
    if not parent_changed or defect is None or not defect.external_issue_id:
        return

    integration = (
        db.query(models.IssueTrackerIntegration)
        .filter(
            models.IssueTrackerIntegration.project_id == defect.project_id,
            models.IssueTrackerIntegration.tracker_type == "azure-devops",
            models.IssueTrackerIntegration.is_active.is_(True),
        )
        .first()
    )
    if not integration:
        return

    try:
        from ..sync_service import SyncService

        client = SyncService.create_azure_devops_client(_integration_payload(integration))
        result = client.link_parent_work_item(defect.external_issue_id, defect.ado_parent_work_item_id)
        if not result.get("success"):
            logger.warning(
                "ado-parent-link: defect %s -> parent %s failed: %s",
                defect.defect_id, defect.ado_parent_work_item_id, result.get("message"),
            )
    except Exception:
        logger.exception("ado-parent-link: unexpected error for defect %s", defect.defect_id)


def _record_failure(db: Session, defect: models.Defect, message: str) -> None:
    # Defect has no sync_error column; external_sync_status is the only signal,
    # so the detail goes to the log rather than a phantom attribute.
    defect.external_sync_status = "error"
    defect.external_last_sync = datetime.now(UTC)
