from datetime import datetime, timezone, timedelta
from typing import Any, Mapping, Optional


COMPLETED_RESULT_STATUSES = {
    "pass",
    "passed",
    "fail",
    "failed",
    "block",
    "blocked",
    "skip",
    "skipped",
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _normalize_status(value: Optional[str]) -> str:
    return str(value or "").strip().lower().replace("-", "_")


def _is_completed_result_status(value: Optional[str]) -> bool:
    return _normalize_status(value) in COMPLETED_RESULT_STATUSES


def apply_test_result_execution_timing(test_result: Any, incoming_data: Mapping[str, Any]) -> None:
    """Keep execution start and elapsed seconds consistent for result status changes."""
    status = incoming_data.get("status", getattr(test_result, "status", None))
    if not _is_completed_result_status(status):
        return

    now = _utc_now()
    started_at = getattr(test_result, "execution_started_at", None)
    explicit_execution_time = incoming_data.get("execution_time")

    if started_at is None:
        if explicit_execution_time is not None and float(explicit_execution_time) > 0:
            started_at = now - timedelta(seconds=float(explicit_execution_time))
        else:
            started_at = now
        setattr(test_result, "execution_started_at", started_at)

    if explicit_execution_time is None:
        elapsed_seconds = max(0.0, (now - _as_aware_utc(started_at)).total_seconds())
        setattr(test_result, "execution_time", round(elapsed_seconds, 2))

    setattr(test_result, "executed_at", now)
