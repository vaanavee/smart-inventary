"""Decides whether a tracked person is carrying a box.

Vision-only heuristic (not a semantic "holding" model): a person is treated as
carrying when a detected `box` overlaps their body box AND that overlap holds for
several consecutive frames (debounce), which filters out a box that merely passes
behind someone or a one-frame false positive.

Kept deliberately small and pure (like identity_matcher.py) so it can be unit
tested without a camera or model. The room-to-room decision is NOT made here —
that comes from the RFID room transition combined with this carry state.
"""
from __future__ import annotations

Box = tuple[float, float, float, float]  # x1, y1, x2, y2


def _is_held(person_box: Box, box: Box, max_area_ratio: float) -> bool:
    """A box counts as held by a person when its centre lies inside the person's
    bounding box and it is smaller than the person (a carried item, not the
    background/room)."""
    px1, py1, px2, py2 = person_box
    bx1, by1, bx2, by2 = box
    cx, cy = (bx1 + bx2) / 2.0, (by1 + by2) / 2.0
    inside = px1 <= cx <= px2 and py1 <= cy <= py2
    person_area = max(1.0, (px2 - px1) * (py2 - py1))
    box_area = max(0.0, (bx2 - bx1)) * max(0.0, (by2 - by1))
    smaller = box_area <= person_area * max_area_ratio
    return inside and smaller


class CarryTracker:
    def __init__(self, min_frames: int = 8, max_area_ratio: float = 0.9) -> None:
        self.min_frames = min_frames
        self.max_area_ratio = max_area_ratio
        self._streak: dict[int, int] = {}

    def update(self, persons: list[dict], boxes: list[Box]) -> dict[int, bool]:
        """Returns {tracker_id: is_carrying}.

        persons: [{"tracker_id": int, "box": (x1,y1,x2,y2)}, ...]
        boxes:   [(x1,y1,x2,y2), ...] of detected boxes this frame
        """
        present: set[int] = set()
        result: dict[int, bool] = {}

        for person in persons:
            tid = person["tracker_id"]
            present.add(tid)
            held = any(_is_held(person["box"], b, self.max_area_ratio) for b in boxes)
            self._streak[tid] = self._streak.get(tid, 0) + 1 if held else 0
            result[tid] = self._streak[tid] >= self.min_frames

        # Forget people who are no longer in frame (lost track).
        for tid in list(self._streak):
            if tid not in present:
                del self._streak[tid]

        return result
