"""Re-derive test run status from results for runs left in a stale state

A run's status used to be computed (and written back) by the run detail page,
so it only changed when somebody opened that page: runs whose results were all
executed sat at "pending" in the list forever, and merely opening a freshly
seeded run stamped it "running" before anything had been executed. The status is
derived on the server now, on every write that touches results — this brings
existing rows in line so the backlog doesn't wait for the next execution.

Only runs currently in a non-terminal state (pending / running / in_progress /
unset) are recomputed. A run somebody marked completed or failed by hand is
left exactly as it is.

Revision ID: resync_test_run_status
Revises: unescape_stored_user_text
Create Date: 2026-09-07 17:40:00.000000

"""
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "resync_test_run_status"
down_revision = "unescape_stored_user_text"
branch_labels = None
depends_on = None


# Result statuses that mean "not executed yet", in every spelling that has ever
# been stored.
_UNEXECUTED = ("not_started", "not_tested", "untested", "pending", "")
_FAILING = ("fail", "failed", "block", "blocked")
# Statuses this migration is allowed to overwrite; a hand-set terminal status is
# never touched.
_RESYNCABLE = ("pending", "running", "in_progress")


def upgrade():
    bind = op.get_bind()
    now = datetime.now(timezone.utc)

    runs = bind.execute(
        sa.text(
            "SELECT id, status, started_at, completed_at FROM test_runs"
        )
    ).fetchall()

    for run_id, status, started_at, completed_at in runs:
        current = (status or "").strip().lower().replace("-", "_")
        if current and current not in _RESYNCABLE:
            continue

        counts = bind.execute(
            sa.text(
                "SELECT LOWER(TRIM(COALESCE(status, ''))) AS s, COUNT(*) AS n "
                "FROM test_results WHERE test_run_id = :run_id GROUP BY s"
            ),
            {"run_id": run_id},
        ).fetchall()

        executed = sum(n for s, n in counts if s not in _UNEXECUTED)
        unexecuted = sum(n for s, n in counts if s in _UNEXECUTED)
        failing = sum(n for s, n in counts if s in _FAILING)

        if executed == 0:
            target, target_started, target_completed = "pending", None, None
        elif unexecuted > 0:
            target = "running"
            target_started = started_at or now
            target_completed = None
        else:
            target = "failed" if failing > 0 else "completed"
            target_started = started_at or now
            target_completed = completed_at or now

        if current == target and started_at == target_started and completed_at == target_completed:
            continue

        bind.execute(
            sa.text(
                "UPDATE test_runs SET status = :status, started_at = :started_at, "
                "completed_at = :completed_at WHERE id = :run_id"
            ),
            {
                "status": target,
                "started_at": target_started,
                "completed_at": target_completed,
                "run_id": run_id,
            },
        )


def downgrade():
    # Derived data: the previous values were themselves stale, so there is
    # nothing meaningful to restore.
    pass
