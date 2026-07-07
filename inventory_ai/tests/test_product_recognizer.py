"""Unit tests for label mapping and product counting."""
from backend.inference.rtdetr_detector import Detection
from backend.models.product_recognizer import count_products, recognize


def _det(label: str, confidence: float = 0.9) -> Detection:
    return Detection(label=label, confidence=confidence, box=(0.0, 0.0, 10.0, 10.0))


def test_recognize_maps_coco_label_to_catalog_name():
    recognized = recognize([_det("book"), _det("scissors")])
    names = {r.name for r in recognized}
    assert names == {"Book", "Scissors"}


def test_recognize_flags_unmapped_label_as_unknown():
    recognized = recognize([_det("giraffe")])
    assert recognized[0].name.startswith("Unknown")


def test_count_products_aggregates_by_name():
    recognized = recognize([_det("book"), _det("book"), _det("scissors")])
    counts = count_products(recognized)
    assert counts == {"Book": 2, "Scissors": 1}


def test_visually_unrelated_coco_labels_are_not_mapped_to_catalog_products():
    """cell phone/remote/cup were previously mismapped to Calculator/Water
    Bottle, causing false WRONG_PRODUCT verifications when an unrelated
    object (e.g. a worker's phone) appeared in frame. They must surface as
    Unknown, not silently become a catalog product."""
    recognized = recognize([_det("cell phone"), _det("remote"), _det("cup")])
    names = {r.name for r in recognized}
    assert names == {"Unknown (cell phone)", "Unknown (remote)", "Unknown (cup)"}
