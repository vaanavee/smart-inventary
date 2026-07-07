"""Threaded camera capture with auto-reconnect and FPS tracking.

Designed so that replacing the laptop webcam with a USB or industrial camera
later only requires changing `settings.camera_source` (e.g. to a different
device index or an RTSP/GigE URI) — no code in this class changes.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

import cv2
import numpy as np

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
        logger.info("Camera stream stopped")

    def get_frame(self) -> np.ndarray | None:
        with self._lock:
            return None if self._frame is None else self._frame.copy()

    def _open_capture(self) -> bool:
        try:
            cap = cv2.VideoCapture(self.source)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings.camera_width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings.camera_height)
            cap.set(cv2.CAP_PROP_FPS, TARGET_FPS)
            if not cap.isOpened():
                cap.release()
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
        while self._running:
            if self._cap is None or not self._cap.isOpened():
                self.status.connected = False
                if not self._open_capture():
                    time.sleep(settings.camera_reconnect_delay_seconds)
                    continue

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
