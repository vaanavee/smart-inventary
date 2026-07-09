"""Thin client for the Node backend's RFID/alerts endpoints.

Authenticates once as admin (reusing the same login the dashboard uses) so
it can read active room sessions, and re-authenticates transparently if the
token expires.
"""
from __future__ import annotations

import os

import httpx

from backend.monitor_service.config import NODE_API_URL
from backend.utils.logger import get_logger

logger = get_logger("system")

ADMIN_USERNAME = os.environ.get("MONITOR_NODE_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("MONITOR_NODE_ADMIN_PASSWORD", "admin123")


class NodeClient:
    def __init__(self) -> None:
        self._token: str | None = None

    def _login(self) -> str | None:
        try:
            resp = httpx.post(
                f"{NODE_API_URL}/auth/login",
                json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
                timeout=3.0,
            )
            resp.raise_for_status()
            self._token = resp.json()["token"]
            return self._token
        except Exception as exc:  # noqa: BLE001 - network/auth errors vary widely
            logger.error("Could not authenticate with Node backend: %s", exc)
            self._token = None
            return None

    def _authed_get(self, path: str) -> httpx.Response | None:
        if self._token is None and self._login() is None:
            return None
        try:
            resp = httpx.get(
                f"{NODE_API_URL}{path}",
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=3.0,
            )
            if resp.status_code == 401:
                if self._login() is None:
                    return None
                resp = httpx.get(
                    f"{NODE_API_URL}{path}",
                    headers={"Authorization": f"Bearer {self._token}"},
                    timeout=3.0,
                )
            resp.raise_for_status()
            return resp
        except Exception as exc:  # noqa: BLE001
            logger.error("Node backend request failed (%s): %s", path, exc)
            return None

    def current_sessions(self, room: str) -> list[dict]:
        resp = self._authed_get("/room-entries/current")
        if resp is None:
            return []
        return [s for s in resp.json() if s.get("room") == room]

    def all_current_sessions(self) -> list[dict]:
        """Open RFID sessions across every room (used to detect A->B transitions)."""
        resp = self._authed_get("/room-entries/current")
        if resp is None:
            return []
        return resp.json()

    def post_alert(self, alert_type: str, room: str, person: str | None = None) -> None:
        try:
            httpx.post(
                f"{NODE_API_URL}/alerts",
                json={"type": alert_type, "room": room, "person": person},
                timeout=3.0,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Could not post alert to Node backend: %s", exc)

    def post_detection(self, tracking_id: int, emp_id: str | None, confidence: float, room: str) -> None:
        try:
            httpx.post(
                f"{NODE_API_URL}/monitor/detections",
                json={"tracking_id": tracking_id, "emp_id": emp_id, "confidence": confidence, "room": room},
                timeout=3.0,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Could not post detection to Node backend: %s", exc)

    def post_transfer(self, transfer: dict) -> None:
        """Record a detected box transfer (room A -> room B while carrying a box)."""
        try:
            httpx.post(f"{NODE_API_URL}/transfers", json=transfer, timeout=3.0)
        except Exception as exc:  # noqa: BLE001
            logger.error("Could not post transfer to Node backend: %s", exc)
