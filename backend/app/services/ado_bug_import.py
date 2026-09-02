"""Periodic import of not-closed Azure DevOps bugs into the local ``defects`` table.

Runs as an in-process background loop (started from ``main.py``'s lifespan),
the same shape as ``token_cleanup.py``: a dedicated thread with its own event
loop, coordinated across replicas by a DB-backed lease so only one replica
does the work per cycle. No separate worker process or broker is introduced.

The job re-queries Azure DevOps for the *full* not-closed-bug set every cycle
rather than tracking deltas. That single query does double duty: on the very
first run it backfills every bug already open in the project, and on every
later run it both discovers new bugs and re-affirms the status of ones
already imported - a bug that drops out of the not-closed set has moved to
Closed/Removed since the last cycle. Title/description are only written when
a defect is first created; only status is kept in sync afterward, so a local
edit to an imported defect's text isn't silently overwritten by the next poll.
"""
import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from .. import models

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 10
_LEASE_KEY = "ado_bug_import_last_run"


def _integration_payload(integration: models.IssueTrackerIntegration):
    return {
        "id": integration.id,
        "tracker_type": integration.tracker_type,
        "api_url": integration.api_url,
        "api_token": integration.api_token,
        "project_key": integration.project_key,
        "name": integration.name,
    }


def _defect_work_item_type(integration: models.IssueTrackerIntegration) -> str:
    """The work item type this project's integration treats as a defect
    (``sync_config.work_item_type``, same setting used to create defects on
    push) - not hardcoded to 'Bug', since projects on the Basic process
    template use 'Issue' instead and would otherwise never get imported."""
    return (integration.sync_config or {}).get("work_item_type") or "Bug"


def _active_ado_integrations(db: Session):
    """Azure DevOps integrations opted into pulling from the tracker.

    ``sync_direction`` already models this exact choice ("import" or
    "bidirectional" vs. push-only "export") - no new column needed.
    """
    return (
        db.query(models.IssueTrackerIntegration)
        .filter(
            models.IssueTrackerIntegration.tracker_type == "azure-devops",
            models.IssueTrackerIntegration.is_active.is_(True),
            models.IssueTrackerIntegration.sync_direction.in_(["import", "bidirectional"]),
        )
        .all()
    )


def _url_prefix_for(integration: models.IssueTrackerIntegration) -> str:
    """The 'organization/project/_workitems/edit/' substring identifying this
    integration's work items among defects, since Defect has no per-row
    tracker-type column. ``project_key`` is already stored as 'org/project'."""
    return f"{integration.project_key or ''}/_workitems/edit/"


def _import_bugs_for_integration(db: Session, integration: models.IssueTrackerIntegration) -> None:
    from ..sync_service import SyncService

    payload = _integration_payload(integration)
    result = SyncService.list_azure_devops_active_bugs(payload, work_item_type=_defect_work_item_type(integration))
    if not result.get("success"):
        logger.warning(
            "ado-bug-import: listing bugs failed for integration %s (project %s): %s",
            integration.name, integration.project_id, result.get("message"),
        )
        return

    work_items = result.get("work_items") or []
    now = datetime.now(UTC)
    seen_external_ids = set()

    for work_item in work_items:
        mapped = SyncService.map_azure_devops_work_item_to_defect(work_item)
        external_id = mapped["external_issue_id"]
        if not external_id:
            continue
        seen_external_ids.add(external_id)

        existing = (
            db.query(models.Defect)
            .filter(
                models.Defect.project_id == integration.project_id,
                models.Defect.external_issue_id == external_id,
            )
            .first()
        )

        if existing is None:
            defect = models.Defect(
                title=mapped["title"],
                description=mapped["description"],
                severity=models.DefectSeverity(mapped["severity"]),
                status=models.DefectStatus(mapped["status"]),
                project_id=integration.project_id,
                reported_by=integration.created_by,
                external_issue_id=external_id,
                external_issue_url=mapped["external_issue_url"],
                external_sync_status="synced",
                external_last_sync=now,
            )
            db.add(defect)
            try:
                db.commit()
                logger.info(
                    "ado-bug-import: imported bug %s as %s (project %s)",
                    external_id, defect.defect_id, integration.project_id,
                )
            except Exception:
                db.rollback()
                logger.exception(
                    "ado-bug-import: failed to create defect for bug %s (project %s)",
                    external_id, integration.project_id,
                )
            continue

        new_status = models.DefectStatus(mapped["status"])
        if existing.status != new_status or existing.external_sync_status != "synced":
            existing.status = new_status
            existing.external_sync_status = "synced"
            existing.external_last_sync = now
            try:
                db.commit()
            except Exception:
                db.rollback()
                logger.exception(
                    "ado-bug-import: failed to update status for defect %s", existing.defect_id,
                )

    _close_out_stale_imports(db, integration, seen_external_ids, now)


def _close_out_stale_imports(
    db: Session,
    integration: models.IssueTrackerIntegration,
    seen_external_ids: set,
    now: datetime,
) -> None:
    """A previously-imported bug that no longer appears in the not-closed set
    has moved to Closed/Removed since the last cycle - fetch it directly and
    mirror its real status instead of leaving it stuck open in TestMona."""
    url_prefix = _url_prefix_for(integration)
    tracked = (
        db.query(models.Defect)
        .filter(
            models.Defect.project_id == integration.project_id,
            models.Defect.external_sync_status == "synced",
            models.Defect.external_issue_id.isnot(None),
            models.Defect.external_issue_url.ilike(f"%{url_prefix}%"),
        )
        .all()
    )
    stale = [d for d in tracked if d.external_issue_id not in seen_external_ids]
    if not stale:
        return

    from ..sync_service import SyncService

    client = SyncService.create_azure_devops_client(_integration_payload(integration))
    for defect in stale:
        try:
            result = client.get_work_item(defect.external_issue_id)
        except Exception:
            logger.exception(
                "ado-bug-import: failed to re-check bug %s (project %s)",
                defect.external_issue_id, integration.project_id,
            )
            continue
        if not result.get("success"):
            continue

        raw = result.get("work_item") or {}
        fields = raw.get("fields", {})
        state = (fields.get("System.State") or "").strip().lower()
        mapped_status = SyncService._ADO_STATE_TO_DEFECT_STATUS.get(state, "open")
        new_status = models.DefectStatus(mapped_status)
        if defect.status != new_status:
            defect.status = new_status
            defect.external_last_sync = now
            try:
                db.commit()
                logger.info(
                    "ado-bug-import: bug %s moved to %s, defect %s -> %s",
                    defect.external_issue_id, state, defect.defect_id, mapped_status,
                )
            except Exception:
                db.rollback()
                logger.exception(
                    "ado-bug-import: failed to close out defect %s", defect.defect_id,
                )


def run_import_cycle(db: Session) -> None:
    try:
        integrations = _active_ado_integrations(db)
    except Exception:
        logger.exception("ado-bug-import: failed to look up Azure DevOps integrations")
        return

    for integration in integrations:
        try:
            _import_bugs_for_integration(db, integration)
        except Exception:
            db.rollback()
            logger.exception(
                "ado-bug-import: cycle failed for integration %s (project %s)",
                integration.name, integration.project_id,
            )


def _try_acquire_import_lease(db: Session) -> bool:
    """Same DB-lease trick as token_cleanup.py: one replica per cycle."""
    from sqlalchemy.exc import IntegrityError

    from ..models import SystemSettings

    now = datetime.now(UTC)
    row = (
        db.query(SystemSettings)
        .filter(SystemSettings.key == _LEASE_KEY)
        .with_for_update()
        .first()
    )

    if row is None:
        db.add(SystemSettings(
            key=_LEASE_KEY,
            value=now.isoformat(),
            description="Last cluster-wide Azure DevOps bug import run (UTC).",
        ))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return False
        return True

    last_run_raw = row.value
    try:
        last_run = datetime.fromisoformat(last_run_raw) if last_run_raw else None
        if last_run and not last_run.tzinfo:
            last_run = last_run.replace(tzinfo=UTC)
    except ValueError:
        last_run = None

    if last_run is not None and (now - last_run).total_seconds() < POLL_INTERVAL_SECONDS:
        db.rollback()
        return False

    row.value = now.isoformat()
    db.commit()
    return True


async def ado_bug_import_job():
    import asyncio

    from ..database import SessionLocal

    while True:
        try:
            db = SessionLocal()
            try:
                if _try_acquire_import_lease(db):
                    run_import_cycle(db)
            finally:
                db.close()
        except Exception:
            logger.warning("ado-bug-import: error in import job", exc_info=True)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


def start_ado_bug_import():
    """Start the Azure DevOps bug import background job."""
    import asyncio
    import threading

    def run_job():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(ado_bug_import_job())

    thread = threading.Thread(target=run_job, daemon=True)
    thread.start()
    logger.info("🚀 Azure DevOps bug import job started in background")
