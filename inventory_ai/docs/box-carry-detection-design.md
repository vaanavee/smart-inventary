# Design — Employee Box-Carry Detection & Room-to-Room Transfer Logging

**Status:** Design only (no implementation yet).
**Goal:** Detect when an employee physically carries a box from one room to
another, and log it as a **Source → Destination** stock movement — reusing the
existing RFID room-entry system for the *room* logic and a fine-tuned RT-DETRv2
model for the *"is this person carrying a box"* vision part.

---

## 1. Why this architecture (RFID rooms + box detection)

Pure computer vision would have to re-identify the *same* person across a
separate camera in every room — cross-camera person re-ID is hard and error
prone. We avoid it entirely:

- **Which room, and the A→B transition** comes from the **RFID room-entry
  system** that already exists (`server/routes/roomEntries.js`, `room_entries`
  table). An `/scan` at a door checks an employee in/out of a room; `/current`
  says who is inside now; `/stream` pushes every entry/exit as an SSE event.
- **"Carrying a box"** is the *only* thing the vision model must answer. That is
  a small, trainable detection problem.
- **Which employee** a camera track belongs to is already solved by
  `IdentityMatcher` (assigns a tracked person to an active RFID session).

So the model stays simple, the single-camera-per-room setup already in place is
enough, and identity/room come from RFID.

```
 RTSP camera (per room) ──► RT-DETRv2 (person + box) ──► ByteTrack ──►
   ├─ IdentityMatcher ─────► which employee (from RFID session)
   └─ carry heuristic ─────► is that employee carrying a box?
                                     │
 RFID /scan entry/exit ──► room transition A→B per employee
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                                ▼
        combine: employee X was carrying a box AND left Room A, entered Room B
                     ▼
        record Box Transfer:  emp X · Room A → Room B · product? · time
```

---

## 2. Vision model — classes & labeling

**Recommended: two classes — `person` and `box`** (not one holistic
`person_carrying_box` class). Associate box↔person geometrically at inference
time. This keeps boxes reusable and the "carrying" decision tunable.

Important constraint from the current setup: `train_rtdetr.py` builds `id2label`
from the dataset's COCO `categories` and loads the base checkpoint with
`ignore_mismatched_sizes=True` — i.e. **the classification head is
re-initialized** for the new label set. Consequence: the fine-tuned model only
knows the classes present in your annotations. So **label BOTH `person` and
`box`** in the training images, or the model will forget `person`.
(COCO has `suitcase`/`backpack`/`handbag` but no cardboard "box", which is why
a fine-tune is needed at all.)

Suggested `categories`:
```json
[ { "id": 0, "name": "person" }, { "id": 1, "name": "box" } ]
```

**Data capture:** the existing `backend/training/capture_images.py` already grabs
webcam/RTSP frames to `dataset/images/<slug>_NNN.jpg`. Extend usage to capture
scenes of employees holding/carrying boxes in the actual rooms, varied by:
person, box size, hold pose (both hands, on shoulder, at side), distance, and
lighting. Aim for a few hundred images minimum, split across "carrying" and
"not carrying / box on shelf / empty room" negatives.

**Annotation:** COCO bbox format (CVAT / Roboflow / Label Studio → export COCO).
The loader `backend/training/coco_dataset.py` already consumes exactly this
(`images` + `annotations[bbox, category_id]` + `categories`), no pycocotools
needed.

---

## 3. Training (you have data + GPU)

Reuse the existing pipeline unchanged:

```bash
# 1. Split your COCO file into train/val
python -m backend.training.prepare_dataset \
    --input dataset/labels/instances.json \
    --output-dir dataset/labels --val-ratio 0.2

# 2. Fine-tune RT-DETR on person+box (GPU picked up automatically by HF Trainer)
python -m backend.training.train_rtdetr \
    --train-annotations dataset/labels/train.json \
    --val-annotations dataset/labels/val.json \
    --images-dir dataset/images \
    --output-dir backend/models/checkpoints/rtdetr-personbox \
    --epochs 30 --batch-size 4 --learning-rate 1e-5
```

Base checkpoint stays `PekingU/rtdetr_r50vd_coco_o365`. Output is a HF checkpoint
dir. **No training-code changes needed** — only the dataset differs.

**Swap it into inference** with zero pipeline edits: point
`settings.rtdetr_checkpoint` (or pass `checkpoint=` to `RTDETRDetector`) at
`backend/models/checkpoints/rtdetr-personbox`. `RTDETRDetector.detect()` already
returns `Detection(label, confidence, box)` with `label` from the model's
`id2label`, so it will start emitting `"box"` detections alongside `"person"`.

---

## 4. Inference integration (in `backend/monitor_service/main.py`)

Today `_processing_loop` filters `d.label == "person"`, tracks with ByteTrack,
and matches to RFID via `IdentityMatcher`. Extend it:

1. **Split detections** into `persons` and `boxes` from `detector.detect(frame)`.
2. **Person tracking + identity**: unchanged (ByteTrack → IdentityMatcher →
   `emp_id`).
3. **Carry association (geometry):** a person is *carrying* if a `box` detection
   overlaps their bbox — e.g. box center inside the person box, or IoU above a
   threshold — **sustained for ≥ K consecutive frames** (debounce, e.g. K≈8 at
   ~real fps) to avoid flicker. Track a per-`tracker_id` `carrying` boolean.
4. **Expose carry state** in the `/live` snapshot per track (`carrying: true`)
   so the dashboard can badge it, and in the overlay (e.g. a "BOX" tag).

This is a new module, e.g. `backend/monitor_service/carry_tracker.py`
(mirrors how `identity_matcher.py` is a small, single-purpose helper), holding
the per-track debounced carry state.

---

## 5. Room-transition state machine → transfer record

A move from Room A to Room B = an RFID **exit scan at A** followed by an
**entry scan at B** for the same employee. Combine with carry state:

- The monitor service maintains, per `emp_id`, `was_carrying_recently` (true if
  vision saw them carrying a box within the last N seconds).
- Subscribe to RFID room events (poll `GET /room-entries/current` each cycle as
  `NodeClient` already does for sessions, or consume the `/room-entries/stream`
  SSE). Detect the transition: employee's room changed A → B.
- **On transition A→B where `was_carrying_recently` is true → emit a Box
  Transfer**: `{ emp_id, employee_name, from_room: A, to_room: B, product_id?,
  time }`.

**Product identity of the box** (optional, high-value tie-in): the vision "box"
is generic. Resolve *which product* by pairing with the **QR feature already
built** — when the employee scans the box's QR (which encodes product + intended
`src → dst`), match it to the detected transfer by employee + time window. If no
QR, log the transfer as an "unidentified box". This makes QR + vision confirm
each other.

---

## 6. Data model & API additions (new)

The existing `movements` table (`server/db.js`) is room+rack+`action`
(Taken/Placed) — it has no `from`→`to` pair, so add a dedicated store:

- **New table `box_transfers`**: `id, date, emp_id, employee_name, from_room,
  to_room, product_id (nullable), start_time, end_time, source
  ('vision' | 'vision+qr'), status`.
- **New Node endpoints** (`server/routes/monitor.js` or a new `transfers.js`):
  - `POST /api/monitor/transfers` — called by the monitor service to record a
    detected transfer (service-authenticated, like existing `NodeClient` posts).
  - `GET /api/transfers?date=` — for the dashboard.

`NodeClient` (`backend/monitor_service/node_client.py`) already has the auth +
POST plumbing (`post_detection`, `post_alert`); add a `post_transfer(...)`
method following the same pattern.

---

## 7. Dashboard surfacing (dashboard/src/pages/Monitoring.jsx)

- **Employee Monitoring tab**: add a "Box Transfers" table (emp, `From → To`
  with an arrow, product or "Unidentified", time, source badge) fed by
  `GET /monitor-api/transfers?date=`.
- **CCTV tab**: badge tracked people who are `carrying` (from the `/live`
  snapshot) — reuse the existing `Badge` component and the detected-people cards.

---

## 8. Verification plan

1. **Model**: after training, run `RTDETRDetector(checkpoint=...)` on a few held-
   out images; confirm it emits `box` and `person` with sane boxes/confidence.
2. **Carry logic (offline)**: feed a recorded clip of someone carrying a box
   through `_processing_loop`; confirm `carrying` turns true only while the box
   is held and debounces correctly.
3. **RFID transition**: use `POST /api/room-entries/scan` to simulate exit at
   Room 1 and entry at Room 2 for EMP001; confirm a `box_transfers` row with
   `from_room=Room 1, to_room=Room 2` appears when carry was active.
4. **QR pairing**: generate a QR (admin) for the product with `src→dst`, have the
   employee scan it, confirm the transfer resolves the product.
5. **Dashboard**: transfer shows up in Employee Monitoring for the date.

---

## 9. Risks / caveats

- **Head re-init**: must label `person` in the dataset too (see §2), else the
  fine-tune loses person detection.
- **Carry association is heuristic** (geometry + tracking), not a semantic
  "holding" model — tune the overlap threshold and K-frame debounce on real
  footage; occlusion and boxes set on shelves are the main false-positive
  sources (mitigated by requiring the person to be *moving between rooms*).
- **Single camera per room**: the A→B decision leans on RFID, not vision, by
  design — so it's only as good as the door scans.
- **Identity**: `IdentityMatcher` is order-of-appearance, not biometric — a
  transfer's employee is only as reliable as that assignment (fine for one new
  person at a time).
- **CPU vs GPU at inference**: two-class detection is the same cost as now;
  real-time still wants the GPU the monitor service runs on.

---

## 10. Build order (when approved to implement)

1. Label dataset (person + box) → train → checkpoint.
2. Swap checkpoint in settings; confirm `box` detections in `/live`.
3. `carry_tracker.py` + carry state in snapshot/overlay.
4. `box_transfers` table + Node `POST/GET` endpoints + `NodeClient.post_transfer`.
5. Room-transition state machine in the monitor service.
6. Optional QR pairing for product identity.
7. Dashboard "Box Transfers" table + carry badges.
