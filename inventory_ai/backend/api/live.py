"""Live camera + detection endpoints."""
from __future__ import annotations

import base64
import time
import threading

import cv2
import numpy as np
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.camera.webcam_stream import camera_stream
from backend.inference.rtdetr_detector import detector
from backend.models.product_recognizer import count_products, recognize
from backend.schemas import CameraStatusOut, LiveDetectionOut
from backend.utils.logger import get_logger

logger = get_logger("live_api")

router = APIRouter(prefix="/live", tags=["live"])

_detections_cache: list[dict] = []
_counts_cache: dict[str, int] = {}
_cache_lock = threading.Lock()
_detection_thread: threading.Thread | None = None
_detection_running = False


def _detection_loop() -> None:
    global _detections_cache, _counts_cache, _detection_running
    logger.info("Live detection background thread started")
    while _detection_running:
        frame = camera_stream.get_frame()
        if frame is None:
            time.sleep(0.1)
            continue
        try:
            raw_detections = detector.detect(frame)
            recognized = recognize(raw_detections)
            counts = count_products(recognized)
            with _cache_lock:
                _detections_cache = [r.to_dict() for r in recognized]
                _counts_cache = counts
        except Exception as e:
            logger.error("Error in live detection background thread: %s", e)
            time.sleep(0.1)
        time.sleep(0.05)
    logger.info("Live detection background thread stopped")


@router.post("/start")
def start_camera() -> CameraStatusOut:
    global _detection_thread, _detection_running
    camera_stream.start()
    if not _detection_running:
        _detection_running = True
        _detection_thread = threading.Thread(target=_detection_loop, daemon=True)
        _detection_thread.start()
    return CameraStatusOut(**camera_stream.status.__dict__)


@router.post("/stop")
def stop_camera() -> CameraStatusOut:
    global _detection_running, _detections_cache, _counts_cache
    camera_stream.stop()
    _detection_running = False
    with _cache_lock:
        _detections_cache = []
        _counts_cache = {}
    return CameraStatusOut(**camera_stream.status.__dict__)


@router.get("/status")
def camera_status() -> CameraStatusOut:
    return CameraStatusOut(**camera_stream.status.__dict__)


@router.get("/detections")
def live_detections() -> LiveDetectionOut:
    with _cache_lock:
        detections = list(_detections_cache)
        counts = dict(_counts_cache)
    return LiveDetectionOut(
        camera=CameraStatusOut(**camera_stream.status.__dict__),
        detections=detections,
        counts=counts,
    )


class FrameIn(BaseModel):
    image: str  # base64 JPEG, with or without a data: URL prefix


@router.post("/detect-frame")
def detect_frame(payload: FrameIn) -> LiveDetectionOut:
    """Run RT-DETR on a single frame captured in the browser.

    A cloud-hosted server has no local webcam, so the dashboard captures from
    the viewer's own camera and posts JPEG frames here for detection.
    """
    b64 = payload.image.split(",", 1)[-1]
    frame = None
    try:
        arr = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:  # noqa: BLE001 - malformed client payloads vary
        logger.error("Could not decode posted frame: %s", e)

    if frame is None:
        return LiveDetectionOut(
            camera=CameraStatusOut(
                connected=False, fps=0.0, frame_count=0, last_error="Invalid frame", source="browser"
            ),
            detections=[],
            counts={},
        )

    recognized = recognize(detector.detect(frame))
    return LiveDetectionOut(
        camera=CameraStatusOut(connected=True, fps=0.0, frame_count=0, last_error=None, source="browser"),
        detections=[r.to_dict() for r in recognized],
        counts=count_products(recognized),
    )


def _mjpeg_generator():
    while True:
        frame = camera_stream.get_frame()
        if frame is None:
            time.sleep(0.1)
            continue
        ok, buffer = cv2.imencode(".jpg", frame)
        if not ok:
            continue
        yield (
            b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
        )


@router.get("/stream")
def video_stream() -> StreamingResponse:
    return StreamingResponse(
        _mjpeg_generator(), media_type="multipart/x-mixed-replace; boundary=frame"
    )
