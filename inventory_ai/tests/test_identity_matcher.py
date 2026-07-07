"""Unit tests for the CCTV track-to-RFID-session identity matcher."""
from backend.monitor_service.identity_matcher import IdentityMatcher


def session(emp_id, name, entry_time):
    return {"emp_id": emp_id, "employee_name": name, "entry_time": entry_time}


def test_single_track_matches_single_active_session():
    matcher = IdentityMatcher()
    sessions = [session("EMP001", "Akash", "09:00")]
    result = matcher.update([1], sessions, now=0.0)
    assert result[1]["assignment"].emp_id == "EMP001"
    assert result[1]["should_alert"] is False


def test_unassigned_track_is_unknown_until_alert_threshold():
    matcher = IdentityMatcher(unknown_alert_seconds=3.0)
    result = matcher.update([1], [], now=0.0)
    assert result[1]["assignment"] is None
    assert result[1]["should_alert"] is False

    # Still under threshold.
    result = matcher.update([1], [], now=2.0)
    assert result[1]["should_alert"] is False

    # Crosses threshold - alert fires exactly once.
    result = matcher.update([1], [], now=3.5)
    assert result[1]["should_alert"] is True

    # Same continuous unmatched streak - no repeat alert.
    result = matcher.update([1], [], now=5.0)
    assert result[1]["should_alert"] is False


def test_assignment_never_swaps_while_tracking_continues():
    matcher = IdentityMatcher()
    sessions = [session("EMP001", "Akash", "09:00"), session("EMP002", "Rahul", "09:05")]
    first = matcher.update([1], sessions, now=0.0)
    assigned_emp = first[1]["assignment"].emp_id

    # Even after Rahul (later entry) is the only "available" one left,
    # track 1 keeps whichever employee it already has.
    second = matcher.update([1], sessions, now=1.0)
    assert second[1]["assignment"].emp_id == assigned_emp


def test_oldest_active_session_claims_new_track_first():
    matcher = IdentityMatcher()
    sessions = [session("EMP002", "Rahul", "09:05"), session("EMP001", "Akash", "09:00")]
    result = matcher.update([1], sessions, now=0.0)
    assert result[1]["assignment"].emp_id == "EMP001"


def test_two_tracks_two_sessions_assigned_independently():
    matcher = IdentityMatcher()
    sessions = [session("EMP001", "Akash", "09:00"), session("EMP002", "Rahul", "09:05")]
    result = matcher.update([1, 2], sessions, now=0.0)
    assigned = {result[1]["assignment"].emp_id, result[2]["assignment"].emp_id}
    assert assigned == {"EMP001", "EMP002"}


def test_track_lost_releases_assignment_for_reassignment():
    matcher = IdentityMatcher()
    sessions = [session("EMP001", "Akash", "09:00")]
    matcher.update([1], sessions, now=0.0)

    # Track 1 disappears, track 2 (a different physical detection) appears.
    result = matcher.update([2], sessions, now=1.0)
    assert result[2]["assignment"].emp_id == "EMP001"


def test_employee_checkout_releases_assignment():
    matcher = IdentityMatcher()
    sessions = [session("EMP001", "Akash", "09:00")]
    matcher.update([1], sessions, now=0.0)

    # EMP001 checks out (no longer in active_sessions) - track 1 becomes unknown.
    result = matcher.update([1], [], now=1.0)
    assert result[1]["assignment"] is None
