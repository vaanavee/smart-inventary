"""Box scan -> AI verification endpoint."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.camera.webcam_stream import camera_stream
from backend.inference.rtdetr_detector import detector
from backend.schemas import VerifyRequest, VerifyResponse
from backend.utils.logger import get_logger
from backend.verification.frame_aggregator import capture_and_aggregate
from backend.verification.verifier import verify
from database.models import Product, Transaction, VerificationLog, Worker
from database.session import get_db

router = APIRouter(prefix="/verify", tags=["verify"])
logger = get_logger("system")


@router.post("")
def verify_box(payload: VerifyRequest, db: Session = Depends(get_db)) -> VerifyResponse:
    product = db.query(Product).filter(Product.box_number == payload.box_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail=f"No product registered for box '{payload.box_id}'")

    worker = db.query(Worker).filter(Worker.id == payload.worker_id).first()
    if worker is None:
        raise HTTPException(status_code=404, detail=f"Worker {payload.worker_id} not found")

    if camera_stream.get_frame() is None:
        raise HTTPException(status_code=503, detail="Camera not available. Start the camera first.")

    # Captures a short burst of frames and takes the median count per product
    # rather than trusting a single frame, so one occluded/blurred frame can't
    # flip a correct box to a false mismatch. See frame_aggregator.py.
    detected_counts, avg_confidence = capture_and_aggregate(camera_stream, detector)
    expected_counts = {product.name: product.current_stock}

    result = verify(expected_counts, detected_counts)

    transaction = Transaction(
        worker_id=worker.id,
        product_id=product.id,
        expected_quantity=expected_counts[product.name],
        detected_quantity=sum(detected_counts.values()),
        verification_status=result.status.value,
        confidence_score=round(avg_confidence, 3),
    )
    db.add(transaction)
    db.flush()

    db.add(
        VerificationLog(
            transaction_id=transaction.id,
            box_id=payload.box_id,
            expected_json=json.dumps(expected_counts),
            detected_json=json.dumps(detected_counts),
            result=result.status.value,
        )
    )
    db.commit()

    logger.info("Verified box %s -> %s", payload.box_id, result.status.value)

    return VerifyResponse(
        status=result.status.value,
        expected=result.expected,
        detected=result.detected,
        details=result.details,
        confidence=round(avg_confidence, 3),
        transaction_id=transaction.id,
    )
