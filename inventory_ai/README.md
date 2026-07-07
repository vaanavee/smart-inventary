# AI-Based Inventory Verification & Stock Monitoring System

Real-time product detection, counting, and inventory verification using
RT-DETR, OpenCV, FastAPI, SQLite, and React.

## Project Structure

```
inventory_ai/
  backend/
    api/            FastAPI routers (live, verify, products, history, inventory, workers, analytics, alerts)
    camera/         Webcam capture (threaded, auto-reconnect, FPS)
    inference/      RT-DETR detector wrapper
    models/         Product recognition (label -> catalog mapping) + counting
    verification/   Expected vs detected comparison engine
    analytics/      Aggregation queries for dashboard charts
    config/         Centralized settings (env-overridable)
    utils/          Logging
    training/       RT-DETR fine-tuning pipeline (see docs/training.md)
    main.py         FastAPI app entrypoint
  database/
    models.py       SQLAlchemy ORM models
    seed.py         Dummy data generator (100 products, 1000 transactions)
    product_catalog.py  Canonical product name/category list
  dataset/          Training images + labels (see docs/labeling.md)
  dashboard/        React + Tailwind frontend
  tests/            Pytest suite
  docs/             Guides (install, training, labeling, camera swap, deployment)
```

## Quick Start

See [docs/installation.md](docs/installation.md) for full setup. Summary:

```bash
# Backend
cd inventory_ai
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
python -m database.seed          # generates 100 products + 1000 transactions
uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd inventory_ai/dashboard
npm install
npm run dev
```

Open the dashboard at http://localhost:5174 — it proxies `/api` to the backend on port 8000.

## Documentation

- [Installation Guide](docs/installation.md)
- [How to Train RT-DETR](docs/training.md)
- [How to Add New Products](docs/adding-products.md)
- [How to Label Images](docs/labeling.md)
- [How to Retrain the Model](docs/training.md#retraining)
- [How to Replace the Webcam with a USB/Industrial Camera](docs/camera-swap.md)
- [Deployment Guide](docs/deployment.md)

## Verification Statuses

| Status | Meaning |
|---|---|
| `VERIFIED` | Detected products and quantities match expected exactly |
| `WRONG_PRODUCT` | None of the detected items match any expected product |
| `MISSING_PRODUCT` | An expected product is short on quantity |
| `EXTRA_PRODUCT` | An expected product has more units than expected |
| `UNEXPECTED_PRODUCT` | Expected quantities fully met, plus an extra unlisted product |
| `MIXED_PRODUCTS` | Some expected products are short AND unexpected products are present |

## Notes

- The RT-DETR checkpoint (`PekingU/rtdetr_r50vd_coco_o365`) ships pretrained,
  but its exported label head exposes only the 80 standard COCO classes —
  verified by loading the checkpoint and inspecting `model.config.id2label`
  directly (its name suggests Objects365 coverage too, but that vocabulary
  is not exposed by this export). Of those 80, only 7 are visually the same
  physical object as a catalog product: book, scissors, mouse, keyboard,
  bottle, handbag, backpack (see `_COCO_TO_CATALOG` in
  `backend/models/product_recognizer.py`). Every other catalog product
  (Pencil, Stapler, Tape, Marker, etc.) will show as `Unknown (<label>)`
  until fine-tuned.
- Earlier mappings of `cell phone`/`remote` → Calculator and `cup` → Water
  Bottle were removed: they were visually unrelated guesses that caused
  false `WRONG_PRODUCT` verifications whenever an unrelated object (e.g. a
  worker's phone) appeared in frame. Accuracy on your real catalog requires
  fine-tuning on your own product photos — see
  [docs/training.md](docs/training.md).
