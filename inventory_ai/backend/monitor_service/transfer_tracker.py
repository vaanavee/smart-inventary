"""Detects an employee moving a box from this camera's room to another room.

The room logic comes from RFID, not vision: an employee leaving this room and
appearing (via an open RFID session) in a different room is an A->B move. If the
vision pipeline saw that same employee carrying a box in this room shortly
before, the move is recorded as a box transfer.

Pure and camera-free so it can be unit tested. `note_carrying()` is fed by the
monitor loop's carry state; `update()` is run each RFID poll cycle and returns
the transfers to POST to the Node backend.
"""
from __future__ import annotations


class TransferTracker:
    def __init__(self, home_room: str, carry_window_seconds: float = 30.0) -> None:
        self.home_room = home_room
        self.carry_window = carry_window_seconds
        self._last_room: dict[str, str] = {}   # emp_id -> last observed open room
        self._carry_ts: dict[str, float] = {}   # emp_id -> last time seen carrying here

    def note_carrying(self, emp_id: str, now: float) -> None:
        """Record that this employee was seen carrying a box in the home room."""
        if emp_id:
            self._carry_ts[emp_id] = now

    def update(self, sessions: list[dict], now: float) -> list[dict]:
        """Given all open RFID sessions across rooms, return any A->B box transfers.

        sessions: [{emp_id, employee_name, room, entry_time}, ...] (exit_time is null)
        """
        transfers: list[dict] = []

        for session in sessions:
            emp_id = session.get("emp_id")
            room = session.get("room")
            if not emp_id or not room:
                continue

            prev = self._last_room.get(emp_id)
            if prev is not None and prev != room:
                # Employee moved prev -> room. Emit a transfer only if they left
                # FROM this camera's room while carrying a box recently.
                carried_recently = (now - self._carry_ts.get(emp_id, float("-inf"))) <= self.carry_window
                if prev == self.home_room and carried_recently:
                    transfers.append(
                        {
                            "emp_id": emp_id,
                            "employee_name": session.get("employee_name"),
                            "from_room": prev,
                            "to_room": room,
                            "start_time": None,
                            "end_time": session.get("entry_time"),
                            "source": "vision",
                            "status": "Completed",
                        }
                    )
                    self._carry_ts.pop(emp_id, None)

            self._last_room[emp_id] = room

        return transfers
