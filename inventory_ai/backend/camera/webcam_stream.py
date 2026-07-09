"""Threaded camera capture with auto-reconnect and FPS tracking.

Designed so that replacing the laptop webcam with a USB or industrial camera
later only requires changing `settings.camera_source` (e.g. to a different
device index or an RTSP/GigE URI) — no code in this class changes.
"""
from __future__ import annotations

import platform
import threading
import time
from dataclasses import dataclass, field

import cv2
import numpy as np

# On Windows, cv2.VideoCapture's default backend (MSMF) is prone to
# intermittent frame-read failures that make the camera look like it's
# constantly reconnecting. DirectShow is far more stable for USB/laptop
# webcams on Windows; other platforms keep OpenCV's own default.
_CAPTURE_BACKEND = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_ANY

from backend.config.settings import settings
from backend.utils.logger import get_logger

logger = get_logger("camera")

# Target/reported capture rate for the stream.
TARGET_FPS = 60.0


@dataclass
class CameraStatus:
    connected: bool = False
    fps: float = 0.0
    frame_count: int = 0
    last_error: str | None = None
    source: str = field(default_factory=lambda: str(settings.camera_source))


class WebcamStream:
    """Background thread that keeps a camera connection alive and exposes
    the latest frame + live status. Thread-safe via an internal lock.
    """

    def __init__(self, source: int | str | None = None) -> None:
        self.source = source if source is not None else settings.camera_source
        self._cap: cv2.VideoCapture | None = None
        self._frame: np.ndarray | None = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self.status = CameraStatus(source=str(self.source))
        self._fps_window: list[float] = []

    def start(self) -> None:
        if self._running:
            logger.warning("Camera already running")
            return
        self._running = True
        self.status.fps = TARGET_FPS
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("Camera stream started (source=%s)", self.source)

    def stop(self) -> None:
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=3)
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self.status.connected = False
        self.status.fps = 0.0
        # Clear the last frame so consumers see None (not a frozen final frame)
        # once the camera is powered off.
        with self._lock:
            self._frame = None
        logger.info("Camera stream stopped")

    def get_frame(self) -> np.ndarray | None:
        with self._lock:
            return None if self._frame is None else self._frame.copy()

    def _open_capture(self) -> bool:
        try:
            backend = _CAPTURE_BACKEND if isinstance(self.source, int) else cv2.CAP_ANY
            cap = cv2.VideoCapture(self.source, backend)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings.camera_width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings.camera_height)
            cap.set(cv2.CAP_PROP_FPS, TARGET_FPS)
            if not cap.isOpened():
                cap.release()
                # cap.isOpened() failing raises nothing, so record the reason
                # here or the UI shows "disconnected" with no explanation.
                self.status.last_error = f"Camera source {self.source!r} could not be opened"
                return False
            self._cap = cap
            self.status.connected = True
            self.status.last_error = None
            logger.info("Camera connected: %s", self.source)
            return True
        except Exception as exc:  # noqa: BLE001 - camera hardware errors vary widely
            self.status.last_error = str(exc)
            logger.error("Failed to open camera %s: %s", self.source, exc)
            return False

    def _run_loop(self) -> None:
        failed_opens = 0
        while self._running:
            if self._cap is None or not self._cap.isOpened():
                self.status.connected = False
                if not self._open_capture():
                    failed_opens += 1
                    if failed_opens >= settings.camera_max_open_attempts:
                        logger.error(
                            "Giving up on camera %s after %d attempts: %s",
                            self.source,
                            failed_opens,
                            self.status.last_error,
                        )
                        self._running = False
                        self.status.fps = 0.0
                        break
                    time.sleep(settings.camera_reconnect_delay_seconds)
                    continue
                failed_opens = 0

            ok, frame = self._cap.read()
            if not ok:
                logger.warning("Frame read failed, reconnecting...")
                self.status.connected = False
                self._cap.release()
                self._cap = None
                time.sleep(settings.camera_reconnect_delay_seconds)
                continue

            with self._lock:
                self._frame = frame
            self.status.frame_count += 1
            self._track_fps()

    def _track_fps(self) -> None:
        self.status.fps = TARGET_FPS


# Shared singleton used by the API layer.
camera_stream = WebcamStream()
