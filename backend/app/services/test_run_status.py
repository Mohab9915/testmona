"""Derived status for a test run.

A run's status is a function of its results, not of who is looking at it. It is
``pending`` until a result is actually executed, ``running`` while some results
are executed and others are not, and terminal once every result is executed —
``failed`` when anything failed or was blocked, ``completed`` for a clean run.

This used to be derived (and written back) by the run detail page, so a run only
left ``pending`` when somebody opened it, and opening a freshly seeded run
flipped it to ``running`` even though nothing had been executed. Recomputing it
here, on every path that writes results, keeps the run list truthful without
anyone opening the run's page.
"""

import logging
from datetime import datetime, timezone
from typing import Iterable, Optional, Union

from sqlalchemy.orm import Session

from ..models import TestResult, TestRun
from .milestone_service import (
    BLOCKED_RESULT_STATUSES,
    FAIL_RESULT_STATUSES,
    NOT_STARTED_RESULT_STATUSES,
    _normalize_status,
)

logger = logging.getLogger(__name__)

# A run in one of these is finished and carries a completed_at stamp. "failed"
# is terminal exactly like "completed": both mean the run is over, and only
# "completed" says it was clean.
TERMINAL_RUN_STATUSES = {"completed", "failed"}

# Legacy spellings for "nothing recorded yet" that may still sit in old rows.
_UNEXECUTED_RESULT_STATUSES = NOT_STARTED_RESULT_STATUSES | {"", "pending", "not_tested", "untested"}


def normalize_run_status(value: object) -> str:
    return _normalize_status(value).strip().replace("-", "_").replace(" ", "_")


def derive_test_run_status(result_statuses: Iterable[object]) -> str:
    """Return the status a run with these result statuses should carry."""
    executed = 0
    unexecuted = 0
    failing = 0
    for value in result_statuses:
        status = normalize_run_status(value)
        if status in _UNEXECUTED_RESULT_STATUSES:
            unexecuted += 1
            continue
        executed += 1
        if status in FAIL_RESULT_STATUSES or status in BLOCKED_RESULT_STATUSES:
            failing += 1

    if executed == 0:
        # No results at all, or none executed yet: the run has not started.
        return "pending"
    if unexecuted > 0:
        return "running"
    return "failed" if failing > 0 else "completed"


def refresh_test_run_status(
    db: Session,
    test_run: Union[TestRun, int, None],
    *,
    commit: bool = True,
) -> Optional[str]:
    """Recompute one run's status from its results; returns the status in force.

    Writes (and commits, unless ``commit=False``) only when the stored status or
    its started_at/completed_at stamps drift from what the results say.
    """
    if test_run is None:
        return None
    run = test_run if isinstance(test_run, TestRun) else db.query(TestRun).filter(TestRun.id == test_run).first()
    if run is None:
        return None

    statuses = [row[0] for row in db.query(TestResult.status).filter(TestResult.test_run_id == run.id).all()]
    target = derive_test_run_status(statuses)
    prior = normalize_run_status(run.status)
    is_terminal = target in TERMINAL_RUN_STATUSES
    now = datetime.now(timezone.utc)

    changed = False
    if prior != target:
        run.status = target
        changed = True
    if target == "pending":
        # Nothing executed: the run has not started, so it carries no start stamp.
        if run.started_at is not None:
            run.started_at = None
            changed = True
    elif run.started_at is None:
        run.started_at = now
        changed = True
    if is_terminal:
        if run.completed_at is None:
            run.completed_at = now
            changed = True
    elif run.completed_at is not None:
        run.completed_at = None
        changed = True

    if not changed:
        return target

    if commit:
        from ..crud_modules.projects import safe_commit
        safe_commit(db)
    else:
        db.flush()

    if is_terminal and prior not in TERMINAL_RUN_STATUSES:
        emit_test_run_completed(db, run)
    return target


def emit_test_run_completed(db: Session, run: TestRun) -> None:
    """Fire ``test_run.completed`` for a run that just reached a terminal state.

    Failures are swallowed (inside ``emit_event`` and here) so webhook delivery
    never blocks the write that triggered it.
    """
    try:
        from .webhook_service import emit_event
        emit_event(
            db,
            project_id=run.project_id,
            event="test_run.completed",
            payload={
                "event": "test_run.completed",
                "test_run": {
                    "id": run.id,
                    "name": run.name,
                    "project_id": run.project_id,
                    "test_plan_id": getattr(run, "test_plan_id", None),
                    "milestone_id": getattr(run, "milestone_id", None),
                    "status": run.status,
                    "started_at": run.started_at.isoformat() if run.started_at else None,
                    "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                },
            },
        )
    except Exception:
        logger.exception("Failed to emit test_run.completed")
