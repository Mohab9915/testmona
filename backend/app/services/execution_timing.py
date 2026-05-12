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

# Execution states for pause/resume functionality
EXECUTION_STATES = {
    "idle",
    "running", 
    "paused",
    "completed"
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
    
    # Handle pause/resume state changes
    execution_state = incoming_data.get("execution_state")
    if execution_state:
        setattr(test_result, "execution_state", execution_state)
        
        # Handle pause timing
        if execution_state == "paused":
            setattr(test_result, "paused_at", _utc_now())
            # Update execution_time to current elapsed time when pausing
            started_at = getattr(test_result, "execution_started_at", None)
            if started_at:
                now = _utc_now()
                elapsed_seconds = max(0.0, (now - _as_aware_utc(started_at)).total_seconds())
                elapsed_seconds -= getattr(test_result, "total_paused_time", 0)
                elapsed_seconds += getattr(test_result, "manual_time_adjustment", 0)
                setattr(test_result, "execution_time", round(elapsed_seconds, 2))
        elif execution_state == "running":
            # Resume from pause
            paused_at = getattr(test_result, "paused_at", None)
            total_paused_time = getattr(test_result, "total_paused_time", 0)
            
            if paused_at:
                pause_duration = (_utc_now() - _as_aware_utc(paused_at)).total_seconds()
                total_paused_time += pause_duration
                setattr(test_result, "total_paused_time", total_paused_time)
                setattr(test_result, "paused_at", None)
                # Update execution_time to current elapsed time when resuming
                started_at = getattr(test_result, "execution_started_at", None)
                if started_at:
                    now = _utc_now()
                    elapsed_seconds = max(0.0, (now - _as_aware_utc(started_at)).total_seconds())
                    elapsed_seconds -= total_paused_time
                    elapsed_seconds += getattr(test_result, "manual_time_adjustment", 0)
                    setattr(test_result, "execution_time", round(elapsed_seconds, 2))
    
        
    # Only apply timing logic for completed statuses and not during pause/resume state changes
    # Skip timing calculation if only execution_state is changing (pause/resume operations)
    if not _is_completed_result_status(status):
        return
    
    # Additional check: skip timing calculation if this is a pause/resume operation
    # even for completed statuses, to preserve manual time additions
    keys_incoming = set(incoming_data.keys())
    if keys_incoming == {"execution_state"} or (
        len(keys_incoming) == 1 and "execution_state" in keys_incoming
    ):
        # Only execution_state is changing (pause/resume) - don't recalculate timing
        return

    now = _utc_now()
    started_at = getattr(test_result, "execution_started_at", None)
    explicit_execution_time = incoming_data.get("execution_time")
    manual_time_adjustment = incoming_data.get("manual_time_adjustment", 0)
    total_paused_time = getattr(test_result, "total_paused_time", 0)

    if started_at is None:
        if explicit_execution_time is not None and float(explicit_execution_time) > 0:
            started_at = now - timedelta(seconds=float(explicit_execution_time))
            setattr(test_result, "execution_started_at", started_at)
        elif manual_time_adjustment > 0:
            # If we have manual time adjustment but no start time, don't calculate execution_time
            # Just keep the existing execution_time or set to manual_time_adjustment
            current_execution_time = getattr(test_result, "execution_time", 0)
            if current_execution_time is None or current_execution_time == 0:
                setattr(test_result, "execution_time", round(manual_time_adjustment, 2))
            return
        else:
            started_at = now
            setattr(test_result, "execution_started_at", started_at)

    if explicit_execution_time is None:
        # Calculate elapsed time excluding paused periods
        elapsed_seconds = max(0.0, (now - _as_aware_utc(started_at)).total_seconds())
        elapsed_seconds -= total_paused_time  # Subtract paused time
        elapsed_seconds += manual_time_adjustment  # Add any manual adjustments
        # Ensure execution_time is never negative
        elapsed_seconds = max(0.0, elapsed_seconds)
        setattr(test_result, "execution_time", round(elapsed_seconds, 2))
    else:
        # Use explicit execution_time but ensure it's not negative
        # This prevents override when manual time is added during pause/resume
        safe_execution_time = max(0.0, float(explicit_execution_time))
        setattr(test_result, "execution_time", round(safe_execution_time, 2))
        # Don't update executed_at when explicit execution_time is provided
        # This prevents timestamp conflicts during manual time adjustments
        return

    setattr(test_result, "executed_at", now)
