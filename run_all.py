#!/usr/bin/env python3
"""Launch every Smart Inventory / WisRight AI service from one command.

Starts (each as its own subprocess, output streamed with a coloured prefix):

    1. Node backend (server/)                 -> http://localhost:4000
    2. Python inventory API (FastAPI)         -> http://localhost:8000
    3. Monitor AI service (camera + RT-DETR)  -> http://localhost:5001
    4. Dashboard (Vite / React)               -> http://localhost:5174

Then open the dashboard at http://localhost:5174

Usage
-----
    python run_all.py                # start all four services
    python run_all.py --seed         # seed the Python DB first, then start
    python run_all.py --no-node      # skip the Node backend (e.g. already running)

Press Ctrl+C once to stop everything.
"""
from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERVER_DIR = ROOT / "server"
INVENTORY_DIR = ROOT / "inventory_ai"
DASHBOARD_DIR = INVENTORY_DIR / "dashboard"

IS_WINDOWS = os.name == "nt"
NPM = "npm.cmd" if IS_WINDOWS else "npm"
VENV_PYTHON = (
    INVENTORY_DIR / ".venv" / ("Scripts" if IS_WINDOWS else "bin") / ("python.exe" if IS_WINDOWS else "python")
)

# ANSI colours for per-service log prefixes (ignored gracefully on dumb terminals).
COLORS = ["\033[36m", "\033[32m", "\033[33m", "\033[35m"]
RESET = "\033[0m"


class Service:
    def __init__(self, name: str, cmd: list[str], cwd: Path, color: str) -> None:
        self.name = name
        self.cmd = cmd
        self.cwd = cwd
        self.color = color
        self.proc: subprocess.Popen | None = None

    def start(self) -> None:
        prefix = f"{self.color}[{self.name}]{RESET}"
        print(f"{prefix} starting: {' '.join(self.cmd)}  (cwd={self.cwd})")
        # New process group so Ctrl+C in this launcher does not race the
        # children; we terminate them explicitly on shutdown.
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if IS_WINDOWS else 0
        self.proc = subprocess.Popen(
            self.cmd,
            cwd=str(self.cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=creationflags,
        )
        threading.Thread(target=self._pump_output, daemon=True).start()

    def _pump_output(self) -> None:
        assert self.proc is not None and self.proc.stdout is not None
        prefix = f"{self.color}[{self.name}]{RESET}"
        for line in self.proc.stdout:
            sys.stdout.write(f"{prefix} {line}")
            sys.stdout.flush()

    def stop(self) -> None:
        if self.proc is None or self.proc.poll() is not None:
            return
        prefix = f"{self.color}[{self.name}]{RESET}"
        print(f"{prefix} stopping...")
        try:
            if IS_WINDOWS:
                self.proc.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                self.proc.terminate()
            self.proc.wait(timeout=8)
        except (subprocess.TimeoutExpired, Exception):
            self.proc.kill()


def build_services(include_node: bool) -> list[Service]:
    services: list[Service] = []
    idx = 0

    if include_node:
        services.append(Service("node-4000", [NPM, "start"], SERVER_DIR, COLORS[idx % len(COLORS)]))
        idx += 1

    services.append(
        Service(
            "api-8000",
            [str(VENV_PYTHON), "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"],
            INVENTORY_DIR,
            COLORS[idx % len(COLORS)],
        )
    )
    idx += 1

    services.append(
        Service(
            "monitor-5001",
            [str(VENV_PYTHON), "-m", "backend.monitor_service.main"],
            INVENTORY_DIR,
            COLORS[idx % len(COLORS)],
        )
    )
    idx += 1

    services.append(Service("dashboard-5174", [NPM, "run", "dev"], DASHBOARD_DIR, COLORS[idx % len(COLORS)]))
    return services


def preflight() -> None:
    problems = []
    if not VENV_PYTHON.exists():
        problems.append(f"venv python not found at {VENV_PYTHON} (create it: python -m venv inventory_ai/.venv)")
    if not SERVER_DIR.exists():
        problems.append(f"server/ folder not found at {SERVER_DIR}")
    if not DASHBOARD_DIR.exists():
        problems.append(f"dashboard/ folder not found at {DASHBOARD_DIR}")
    if problems:
        print("Preflight failed:")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)


def seed_database() -> None:
    print("Seeding Python database (100 products, 12 workers, 1000 transactions)...")
    subprocess.run([str(VENV_PYTHON), "-m", "database.seed"], cwd=str(INVENTORY_DIR), check=True)
    print("Seed complete.\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run all Smart Inventory services.")
    parser.add_argument("--seed", action="store_true", help="Seed the Python DB before starting.")
    parser.add_argument("--no-node", action="store_true", help="Do not start the Node backend (port 4000).")
    args = parser.parse_args()

    preflight()
    if args.seed:
        seed_database()

    services = build_services(include_node=not args.no_node)

    for svc in services:
        svc.start()
        time.sleep(1.0)  # small stagger so startup logs stay readable

    print("\n" + "=" * 60)
    print("  All services launching. Open the dashboard at:")
    print("      http://localhost:5174   (admin / admin123)")
    print("  Press Ctrl+C to stop everything.")
    print("=" * 60 + "\n")

    try:
        # Stay alive until interrupted; if any service dies, report it but
        # keep the rest running so you can read the error.
        while True:
            for svc in services:
                if svc.proc is not None and svc.proc.poll() is not None:
                    code = svc.proc.returncode
                    print(f"{svc.color}[{svc.name}]{RESET} exited with code {code}")
                    svc.proc = None  # only report once
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\nShutting down all services...")
        for svc in reversed(services):
            svc.stop()
        print("Done.")


if __name__ == "__main__":
    main()
