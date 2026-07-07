"""Multi-frame detection aggregation.

A single camera frame is noisy: motion blur, glare, or a momentary bad angle
can make the detector miss an object that's actually there (or double-count
one that isn't). Verification results built on one frame inherit that noise
directly into WRONG_PRODUCT/MISSING_PRODUCT calls.

This module captures a short burst of frames and takes the per-product
median count across them, so a single bad frame gets outvoted by the rest
rather than deciding the verification outcome outright. This does not
change what the model can recognize (still limited to the checkpoint's
mapped classes - see product_recognizer.py) - it only makes detections of
those classes more consistent frame-to-frame.
"""
from __future__ import annotations

import statistics
import time
from typing import TYPE_CHECKING

from backend.models.product_recognizer import count_products, recognize

if TYPE_CHECKING:
    from backend.camera.webcam_stream import WebcamStream
    from backend.inference.rtdetr_detector import RTDETRDetector


def aggregate_counts(frame_counts: list[dict[str, int]]) -> dict[str, int]:
    """Combines per-frame product counts into one robust count per product.

    Uses the median across frames for each product name: a product missed
    in 1 of 5 frames (occlusion/blur) is outvoted by the 4 frames that did
    see it, and a spurious detection in 1 of 5 frames doesn't inflate the
    final count either.
    """
    names: set[str] = set()
    for fc in frame_counts:
        names.update(fc.keys())

    aggregated: dict[str, int] = {}
    for name in names:
        counts = [fc.get(name, 0) for fc in frame_counts]
        median_count = round(statistics.median(counts))
        if median_count > 0:
            aggregated[name] = median_count
    return aggregated


def capture_and_aggregate(
    camera_stream: "WebcamStream",
    detector: "RTDETRDetector",
    num_frames: int = 3,
    delay_seconds: float = 0.15,
) -> tuple[dict[str, int], float]:
    """Captures a short burst of frames and returns a noise-robust detection.

    Returns (aggregated_counts, average_confidence_across_all_frames).
    """
    frame_counts: list[dict[str, int]] = []
    all_confidences: list[float] = []

    for i in range(num_frames):
        frame = camera_stream.get_frame()
        if frame is not None:
            raw_detections = detector.detect(frame)
            recognized = recognize(raw_detections)
            frame_counts.append(count_products(recognized))
            all_confidences.extend(r.confidence for r in recognized)
        if i < num_frames - 1:
            time.sleep(delay_seconds)

    aggregated = aggregate_counts(frame_counts)
    avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
    return aggregated, avg_confidence
