"""Maps raw RT-DETR labels to catalog product names, and counts detections.

RT-DETR's COCO checkpoint only knows generic COCO classes (e.g. "book",
"scissors", "cell phone"). This module maps whatever label set the active
checkpoint produces onto the warehouse's product catalog names, so the rest
of the system always deals in catalog names. Once a fine-tuned checkpoint is
trained directly on the product catalog (see backend/training/), this
mapping becomes the identity mapping.
"""
from __future__ import annotations

from collections import Counter

from backend.inference.rtdetr_detector import Detection
from database.product_catalog import PRODUCT_CATALOG

# Maps COCO label -> catalog product name. The default checkpoint
# (PekingU/rtdetr_r50vd_coco_o365) exposes exactly the 80 standard COCO
# classes despite its name, so this list is intentionally short: only
# classes that are actually the same physical object as a catalog product
# are mapped. Visually unrelated guesses (e.g. "cell phone" -> "Calculator")
# were deliberately removed — they caused false WRONG_PRODUCT verifications
# whenever an unrelated COCO object appeared in frame. Anything not listed
# here is surfaced as "Unknown (<raw label>)" rather than silently guessed,
# so operators can see exactly what the model saw.
_COCO_TO_CATALOG = {
    "book": "Book",
    "scissors": "Scissors",
    "mouse": "Mouse",
    "keyboard": "Keyboard",
    "bottle": "Water Bottle",
    "handbag": "Bag",
    "backpack": "Bag",
}


class RecognizedProduct:
    __slots__ = ("name", "confidence", "box", "raw_label")

    def __init__(self, name: str, confidence: float, box: tuple[float, float, float, float], raw_label: str) -> None:
        self.name = name
        self.confidence = confidence
        self.box = box
        self.raw_label = raw_label

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "confidence": round(self.confidence, 3),
            "box": self.box,
            "raw_label": self.raw_label,
        }


def recognize(detections: list[Detection]) -> list[RecognizedProduct]:
    """Converts raw detector output into catalog-aware recognized products."""
    recognized = []
    for det in detections:
        catalog_name = _COCO_TO_CATALOG.get(det.label.lower())
        if catalog_name is None:
            catalog_name = det.label.title() if det.label.title() in PRODUCT_CATALOG else f"Unknown ({det.label})"
        recognized.append(RecognizedProduct(catalog_name, det.confidence, det.box, det.label))
    return recognized


def count_products(recognized: list[RecognizedProduct]) -> dict[str, int]:
    """Aggregates recognized products into {product_name: count}."""
    return dict(Counter(r.name for r in recognized))
