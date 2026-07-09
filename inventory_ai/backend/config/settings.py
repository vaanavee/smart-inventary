"""Centralized application configuration.

All tunables (camera source, DB path, model checkpoint, thresholds) live here
so that swapping the webcam for a USB/industrial camera later is a one-line
change, not a code change.
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # --- App ---
    app_name: str = "AI Inventory Verification System"
    api_prefix: str = "/api"
    debug: bool = True

    # --- Camera ---
    # 0 = default laptop webcam. Replace with an RTSP/USB index or industrial
    # camera URI later without touching camera/webcam_stream.py logic.
    camera_source: int | str = 0
    camera_width: int = 1280
    camera_height: int = 720
    camera_reconnect_delay_seconds: float = 2.0
    # Consecutive failed opens before the capture thread gives up. Without a
    # bound, a source that can never open (e.g. webcam index 0 in a container)
    # retries forever and floods the logs.
    camera_max_open_attempts: int = 5

    # --- RT-DETR model ---
    rtdetr_checkpoint: str = "PekingU/rtdetr_r50vd_coco_o365"
    rtdetr_confidence_threshold: float = 0.5
    rtdetr_device: str = "cpu"  # "cuda" if a GPU is available

    # --- Database ---
    database_path: Path = BASE_DIR / "database" / "inventory.db"
    database_url: str = ""

    # --- Logging ---
    log_dir: Path = BASE_DIR / "backend" / "logs"

    # --- Dummy data ---
    dummy_product_count: int = 100
    dummy_transaction_count: int = 1000

    model_config = SettingsConfigDict(env_file=".env", env_prefix="INV_")

    def model_post_init(self, __context) -> None:
        if not self.database_url:
            self.database_url = "postgresql+psycopg2://postgres:postgres@localhost:5432/inventory_ai"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)


settings = Settings()
