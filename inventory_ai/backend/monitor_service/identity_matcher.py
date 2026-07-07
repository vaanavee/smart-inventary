"""Assigns tracked person IDs to active RFID sessions.

Computer vision alone cannot know *which* physical person is which
employee - there's no biometric matching here. The rule implemented is
deliberately simple and stated plainly: the oldest still-unassigned active
RFID session claims the next track that has no assignment yet. Once a
track is assigned, it keeps that identity until the track is lost or the
employee checks out - it is never reassigned to a different active
session while still visible, per "never swap names unless tracking is
lost".

This is reliable when at most one new, unassigned person enters a room's
camera view at a time (the common case for a single entrance per room). It
is not a substitute for face recognition and can misassign if two
employees who haven't been individually distinguished yet appear in the
same room within the same tracking cycle.
"""
from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass
class Assignment:
    emp_id: str
    employee_name: str
    entry_time: str


class IdentityMatcher:
    def __init__(self, unknown_alert_seconds: float = 3.0) -> None:
        self.unknown_alert_seconds = unknown_alert_seconds
        self._assignments: dict[int, Assignment] = {}
        self._unmatched_since: dict[int, float] = {}
        self._alerted: set[int] = set()

    def update(
        self, tracker_ids: list[int], active_sessions: list[dict], now: float | None = None
    ) -> dict[int, dict]:
        """Returns {tracker_id: {"assignment": Assignment | None, "should_alert": bool}}.

        `active_sessions` is the current list of open RFID sessions for this
        room, each a dict with at least emp_id, employee_name, entry_time.
        `should_alert` is True exactly once per continuous unmatched streak,
        the first time it crosses `unknown_alert_seconds`.
        """
        now = time.time() if now is None else now
        tracker_id_set = set(tracker_ids)

        # Drop bookkeeping for tracks that are no longer visible (lost track).
        for stale in list(self._assignments.keys() - tracker_id_set):
            del self._assignments[stale]
        for stale in list(self._unmatched_since.keys() - tracker_id_set):
            del self._unmatched_since[stale]
        self._alerted &= tracker_id_set

        active_by_emp = {s["emp_id"]: s for s in active_sessions}

        # A track keeps its assignment as long as that employee is still
        # checked in - drop it only if they've checked out.
        for tracker_id in list(self._assignments.keys()):
            if self._assignments[tracker_id].emp_id not in active_by_emp:
                del self._assignments[tracker_id]

        assigned_emp_ids = {a.emp_id for a in self._assignments.values()}
        available = sorted(
            (s for s in active_sessions if s["emp_id"] not in assigned_emp_ids),
            key=lambda s: s["entry_time"],
        )

        results: dict[int, dict] = {}
        for tracker_id in tracker_ids:
            if tracker_id not in self._assignments and available:
                session = available.pop(0)
                self._assignments[tracker_id] = Assignment(
                    emp_id=session["emp_id"],
                    employee_name=session["employee_name"],
                    entry_time=session["entry_time"],
                )
                self._unmatched_since.pop(tracker_id, None)
                self._alerted.discard(tracker_id)

            assignment = self._assignments.get(tracker_id)
            should_alert = False
            if assignment is None:
                self._unmatched_since.setdefault(tracker_id, now)
                unmatched_duration = now - self._unmatched_since[tracker_id]
                if unmatched_duration >= self.unknown_alert_seconds and tracker_id not in self._alerted:
                    self._alerted.add(tracker_id)
                    should_alert = True

            results[tracker_id] = {"assignment": assignment, "should_alert": should_alert}

        return results
