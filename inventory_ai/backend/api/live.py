"""Live camera + detection endpoints."""
from __future__ import annotations

import time
import cv2
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.camera.webcam_stream import camera_stream
from backend.inference.rtdetr_detector import detector
from backend.models.product_recognizer import count_products, recognize
from backend.schemas import CameraStatusOut, LiveDetectionOut

router = APIRouter(prefix="/live", tags=["live"])


@router.post("/start")
def start_camera() -> CameraStatusOut:
    camera_stream.start()
    return CameraStatusOut(**camera_stream.status.__dict__)


@router.post("/stop")
def stop_camera() -> CameraStatusOut:
    camera_stream.stop()
    return CameraStatusOut(**camera_stream.status.__dict__)


@router.get("/status")
def camera_status() -> CameraStatusOut:
    return CameraStatusOut(**camera_stream.status.__dict__)


@router.get("/detections")
def live_detections() -> LiveDetectionOut:
    frame = camera_stream.get_frame()
    if frame is None:
        return LiveDetectionOut(
            camera=CameraStatusOut(**camera_stream.status.__dict__),
            detections=[],
            counts={},
        )
    raw_detections = detector.detect(frame)
    recognized = recognize(raw_detections)
    counts = count_products(recognized)
    return LiveDetectionOut(
        camera=CameraStatusOut(**camera_stream.status.__dict__),
        detections=[r.to_dict() for r in recognized],
        counts=counts,
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
