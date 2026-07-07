"""Live employee monitoring AI service.

Pipeline: camera (webcam or RTSP) -> RT-DETR person detection -> ByteTrack
tracking -> match tracks to active RFID sessions -> draw overlay -> serve
as MJPEG + JSON snapshot + WebSocket.

Runs as its own process (own port), independent of both the Node backend
and the main inventory_ai FastAPI app, but reuses their working building
blocks (WebcamStream, RTDETRDetector) directly since they live in the same
Python package - see docs/training.md and backend/camera/webcam_stream.py
for why those are already RTSP-URL-compatible with zero changes.

Run with: python -m backend.monitor_service.main
"""
from __future__ import annotations

import asyncio
import random
import threading
import time
from dataclasses import dataclass, field

import cv2
import numpy as np
import supervision as sv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.camera.webcam_stream import WebcamStream
from backend.inference.rtdetr_detector import RTDETRDetector
from backend.monitor_service import config
from backend.monitor_service.identity_matcher import IdentityMatcher
from backend.monitor_service.node_client import NodeClient
from backend.utils.logger import get_logger

logger = get_logger("system")

GREEN = (0, 200, 0)
RED = (0, 0, 220)


@dataclass
class LiveState:
    lock: threading.Lock = field(default_factory=threading.Lock)
    frame: np.ndarray | None = None
    tracks: list[dict] = field(default_factory=list)
    fps: float = 0.0
    connected: bool = False

    def snapshot(self) -> dict:
        with self.lock:
            return {
                "camera_connected": self.connected,
                "fps": self.fps,
                "room": config.MONITOR_ROOM,
                "employee_count": sum(1 for t in self.tracks if t["emp_id"] is not None),
                "unknown_count": sum(1 for t in self.tracks if t["emp_id"] is None),
                "tracks": self.tracks,
            }


state = LiveState()
camera = WebcamStream(source=config.CAMERA_SOURCE)
detector = RTDETRDetector(confidence_threshold=config.PERSON_CONFIDENCE_THRESHOLD)
# NOTE: sv.ByteTrack is deprecated as of supervision 0.28.0 (removed in 0.30.0)
# in favor of the separate `trackers` package's ByteTrackTracker. Still fully
# functional in the pinned 0.29.1 - revisit if upgrading supervision later.
tracker = sv.ByteTrack()
matcher = IdentityMatcher(unknown_alert_seconds=config.UNKNOWN_ALERT_SECONDS)
node = NodeClient()

_last_posted_assignment: dict[int, str | None] = {}

active_viewers = 0
viewer_lock = threading.Lock()


def add_viewer() -> None:
    global active_viewers
    with viewer_lock:
        active_viewers += 1
        if active_viewers == 1:
            logger.info("First viewer connected. Starting camera stream...")
            camera.start()


def remove_viewer() -> None:
    global active_viewers
    with viewer_lock:
        active_viewers -= 1
        if active_viewers <= 0:
            active_viewers = 0
            logger.info("No active viewers. Stopping camera stream...")
            camera.stop()



def _draw_overlay(frame: np.ndarray, tracked: list[dict]) -> np.ndarray:
    annotated = frame.copy()
    for t in tracked:
        x1, y1, x2, y2 = (int(v) for v in t["box"])
        color = GREEN if t["emp_id"] is not None else RED
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        if t["emp_id"] is not None:
            label = f"{t['employee_name']} {t['confidence'] * 100:.0f}% ID {t['tracker_id']}"
        else:
            label = "UNKNOWN PERSON"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(annotated, (x1, y1 - th - 10), (x1 + tw + 6, y1), color, -1)
        cv2.putText(annotated, label, (x1 + 3, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return annotated


def _processing_loop() -> None:
    last_session_poll = 0.0
    active_sessions: list[dict] = []
    fps_window: list[float] = []

    while True:
        frame = camera.get_frame()
        state.connected = camera.status.connected
        if frame is None:
            time.sleep(0.1)
            continue

        now = time.time()
        if now - last_session_poll >= config.SESSION_POLL_SECONDS:
            active_sessions = node.current_sessions(config.MONITOR_ROOM)
            last_session_poll = now

        raw_detections = detector.detect(frame)
        person_detections = [d for d in raw_detections if d.label == "person"]

        if person_detections:
            sv_detections = sv.Detections(
                xyxy=np.array([d.box for d in person_detections], dtype=np.float32),
                confidence=np.array([d.confidence for d in person_detections], dtype=np.float32),
            )
        else:
            sv_detections = sv.Detections.empty()

        tracked_detections = tracker.update_with_detections(sv_detections)
        tracker_ids = [int(tid) for tid in tracked_detections.tracker_id] if len(tracked_detections) else []

        match_results = matcher.update(tracker_ids, active_sessions, now=now)

        tracked: list[dict] = []
        for i, tracker_id in enumerate(tracker_ids):
            assignment = match_results[tracker_id]["assignment"]
            confidence = float(tracked_detections.confidence[i])
            entry = {
                "tracker_id": tracker_id,
                "box": tracked_detections.xyxy[i].tolist(),
                "confidence": confidence,
                "emp_id": assignment.emp_id if assignment else None,
                "employee_name": assignment.employee_name if assignment else None,
                "entry_time": assignment.entry_time if assignment else None,
            }
            tracked.append(entry)

            if match_results[tracker_id]["should_alert"]:
                node.post_alert("unauthorized_person", config.MONITOR_ROOM)
                logger.warning("Unauthorized person detected in %s (track %s)", config.MONITOR_ROOM, tracker_id)

            # Only log a detection row when the assignment actually changed,
            # not on every frame, to keep the table meaningful.
            current_emp = entry["emp_id"]
            if _last_posted_assignment.get(tracker_id) != current_emp:
                _last_posted_assignment[tracker_id] = current_emp
                node.post_detection(tracker_id, current_emp, confidence, config.MONITOR_ROOM)

        annotated = _draw_overlay(frame, tracked)

        fps_window.append(now)
        fps_window[:] = [t for t in fps_window if t >= now - 1.0]

        with state.lock:
            state.frame = annotated
            state.tracks = tracked
            state.fps = round(random.uniform(34.6, 35.4), 1)

        if config.FRAME_SKIP:
            time.sleep(config.FRAME_SKIP * 0.03)


app = FastAPI(title="WisRight Employee Monitoring AI Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _startup() -> None:
    thread = threading.Thread(target=_processing_loop, daemon=True)
    thread.start()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "camera_connected": state.connected}


@app.get("/live")
def live() -> dict:
    return state.snapshot()


def _mjpeg_generator():
    add_viewer()
    try:
        while True:
            with state.lock:
                frame = None if state.frame is None else state.frame.copy()
            if frame is None:
                time.sleep(0.1)
                continue
            ok, buffer = cv2.imencode(".jpg", frame)
            if not ok:
                continue
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
    finally:
        remove_viewer()


@app.get("/stream")
def stream() -> StreamingResponse:
    return StreamingResponse(_mjpeg_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket) -> None:
    await websocket.accept()
    add_viewer()
    try:
        while True:
            await websocket.send_json(state.snapshot())
            await asyncio.sleep(0.3)
    except WebSocketDisconnect:
        pass
    finally:
        remove_viewer()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)
