"""Configuration for the live employee-monitoring AI service.

Camera credentials are never hardcoded - they're read from environment
variables (see .env.example) so the real RTSP URL/credentials for a given
site never end up in source control.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Dedicated env file (not inventory_ai/.env - that one is loaded by the main
# FastAPI app's Settings, which forbids unrecognized keys) so these two
# services' configs never collide. MONITOR_ENV_FILE lets a second instance of
# this same service (e.g. an "Entrance" IP-camera zone alongside the default
# "Room 1" webcam zone) load a different env file/port instead of duplicating
# this module - see .env.entrance and docs/camera-swap.md.
_env_file = os.environ.get("MONITOR_ENV_FILE", ".env")
load_dotenv(Path(__file__).resolve().parent / _env_file)


def _camera_source() -> int | str:
    url = os.environ.get("MONITOR_CAMERA_URL")
    if not url:
        # No RTSP configured - fall back to the laptop webcam so the
        # pipeline can be verified without physical camera hardware.
        return 0

    user = os.environ.get("MONITOR_CAMERA_USER")
    password = os.environ.get("MONITOR_CAMERA_PASSWORD")
    if user and password and "://" in url and "@" not in url:
        scheme, rest = url.split("://", 1)
        url = f"{scheme}://{user}:{password}@{rest}"
    return url


CAMERA_SOURCE: int | str = _camera_source()
MONITOR_ROOM: str = os.environ.get("MONITOR_ROOM", "Room 1")
NODE_API_URL: str = os.environ.get("MONITOR_NODE_API_URL", "http://127.0.0.1:4000/api")
NODE_SERVICE_TOKEN: str = os.environ.get("MONITOR_NODE_SERVICE_TOKEN", "")

PERSON_CONFIDENCE_THRESHOLD: float = float(os.environ.get("MONITOR_PERSON_CONFIDENCE", "0.5"))
UNKNOWN_ALERT_SECONDS: float = float(os.environ.get("MONITOR_UNKNOWN_ALERT_SECONDS", "3.0"))
SESSION_POLL_SECONDS: float = float(os.environ.get("MONITOR_SESSION_POLL_SECONDS", "1.0"))
# Box-carry detection: how many consecutive frames a box must overlap a person
# before they count as "carrying", and how long after that a room change still
# counts as a box transfer.
CARRY_MIN_FRAMES: int = int(os.environ.get("MONITOR_CARRY_MIN_FRAMES", "8"))
CARRY_WINDOW_SECONDS: float = float(os.environ.get("MONITOR_CARRY_WINDOW_SECONDS", "30.0"))
FRAME_SKIP: int = int(os.environ.get("MONITOR_FRAME_SKIP", "0"))
HOST: str = os.environ.get("MONITOR_HOST", "0.0.0.0")
PORT: int = int(os.environ.get("MONITOR_PORT", "5001"))
