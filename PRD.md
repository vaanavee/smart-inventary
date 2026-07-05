# Product Requirements Document
## AI-Based Inventory Movement & Stock Monitoring System

| Field | Value |
|---|---|
| Document Type | Product Requirements Document (PRD) |
| Source | AI-Based Inventory Movement & Stock Monitoring System — Project Proposal, 04 July 2026 |
| Status | Draft — for internal review |
| Owner | TBD |
| Last Updated | 2026-07-05 |

---

## 1. Overview

### 1.1 Summary
An RFID + AI camera verification system that automatically counts and verifies products as they move out of warehouse racks, eliminating manual stock-counting errors and providing a real-time, auditable view of inventory movement.

### 1.2 Problem Statement
Manual stock movement today relies on paper logs or basic RFID scans that record what a worker *claims* to have taken, with no independent check on actual quantity. This creates:
- Human error in counting
- Mismatched inventory counts
- Delayed detection of stock discrepancies
- No independent verification of manual entries

### 1.3 Proposed Solution
Add an automated AI verification step so every manual RFID scan is cross-checked against an actual camera-based count (via an RTDETR AI model) before it is accepted into the central database.

### 1.4 Goals
- Eliminate manual stock-counting errors through AI-verified counting.
- Create a live, time-stamped audit trail of every stock movement.
- Give management a real-time dashboard view of inventory health.
- Improve worker accountability without adding significant extra work.

### 1.5 Non-Goals
- Replacing RFID/manual scanning entirely (the system verifies manual entries rather than eliminating them).
- Full computer-vision identification of product *type* on open racks (verification is confined to the enclosed tray to control lighting/clutter).
- Automated procurement or reordering workflows (out of scope for this phase).

---

## 2. Target Users & Applications

### 2.1 User Roles
| Role | Description | Primary Interface |
|---|---|---|
| Warehouse Worker (Labour) | Picks products from racks, scans RFID tags, places items in verification tray | Mobile/Tablet Guide |
| Supervisor / Management | Monitors stock levels, movement trends, and mismatch alerts | Web Dashboard |
| System Administrator | Manages hardware, integrations, and user/rack configuration | Web Dashboard (admin) |

### 2.2 Target Industries
Warehouses, Factories, Retail Stores, Pharmaceutical Storage, E-commerce Fulfilment, Logistics Hubs.

---

## 3. End-to-End Workflow

The system implements a 5-step movement & verification flow:

1. **Labour Entry** — Worker enters the stock room; an RFID reader scans their ID tag and logs entry time automatically.
2. **Rack Identification** — Each rack has its own RFID scanner and a QR code (A, B, C, D…) showing which products are stored there.
3. **Product Taken (Manual)** — Worker picks the required product and scans its RFID tag; entry is logged with labour name, rack, product, quantity, and time.
4. **AI + Tray Verification** — The picked product is placed inside a transparent verification tray. An RTDETR AI camera counts the items and compares the AI count against the manual count.
5. **Data Stored** — Once the AI count matches the manual count, the verified record (labour, rack, product, quantity, time, status) is saved to the central database. A mismatch raises an alert for manual review instead of auto-storing.

---

## 4. Functional Requirements

### 4.1 Labour Entry Tracking
- FR-1: System shall scan an RFID tag assigned to each worker at the stock-room entry door.
- FR-2: System shall automatically log entry time and worker identity on scan.

### 4.2 Rack Identification
- FR-3: Each rack shall be fitted with an RFID scanner and a unique QR code (A, B, C, D…).
- FR-4: Scanning a rack's QR code shall display the list of products stored on that rack to the worker via the mobile guide.

### 4.3 Manual Product Scan
- FR-5: Worker shall scan the product's RFID tag when picking it from a rack.
- FR-6: System shall log labour name, rack ID, product ID, quantity, and timestamp for every manual scan.

### 4.4 AI + Tray Verification
- FR-7: The picked product(s) shall be placed into a transparent, enclosed verification tray.
- FR-8: A top-mounted RTDETR AI camera, aided by built-in LED lighting, shall capture an overhead image of the tray.
- FR-9: The RTDETR model shall detect and count each individual product in the image.
- FR-10: System shall automatically compare the AI-detected count against the manually scanned quantity.
- FR-11: On MATCH, the transaction shall be marked "Verified" and saved to the database.
- FR-12: On MISMATCH, the system shall raise an alert and withhold the record from being auto-stored pending manual review.

### 4.5 Data Storage & Records
- FR-13: Every verified record shall store: labour, rack, product, quantity, time, and status.
- FR-14: All records shall be persisted to a central cloud/server database.
- FR-15: The system shall maintain a centralised, queryable log/report history of all transactions (matched and mismatched).

### 4.6 Employee Mobile Guide
- FR-16: Mobile/tablet app shall display each rack (A, B, C, D…) and the exact products stored there.
- FR-17: App shall support QR code scanning to look up rack contents.
- FR-18: App shall provide scan history, notifications, and worker profile management.

### 4.7 Web Dashboard
- FR-19: Dashboard shall display total products in stock.
- FR-20: Dashboard shall display items running low (low-stock alerts).
- FR-21: Dashboard shall display today's total stock movements.
- FR-22: Dashboard shall display active mismatch alerts.
- FR-23: Dashboard shall provide stock-overview and movement-trend charts.

### 4.8 Hardware / Connectivity
- FR-24: An ESP32 controller shall collect data from all scanners/cameras at a rack/tray cluster and transmit it over Wi-Fi to the cloud.
- FR-25: A shared power supply line shall run across rack scanners and the verification tray per cluster.

---

## 5. System Architecture

### 5.1 Data Flow
```
RFID Tag (Labour) → RFID Reader (Entry Door) → Rack RFID Scanner (Each Rack)
  → Product RFID Scanner → RTDETR Camera (Verification Tray)
  → ESP32 Controller → Cloud / Server Database → Web Dashboard
```

### 5.2 Components
| Component | Function |
|---|---|
| RFID Tag (Labour) | Identifies the worker at the entry door |
| RFID Reader (Entry Door) | Logs entry time and worker identity |
| Rack RFID Scanner | Confirms which rack is being accessed |
| Product RFID Scanner | Captures manual product scan and quantity |
| RTDETR Camera (Verification Tray) | Performs AI count for verification |
| ESP32 Controller | Aggregates scanner/camera data, sends over Wi-Fi |
| Cloud / Server Database | Stores every verified transaction securely |
| Web Dashboard | Live stock levels, alerts, movement trends |
| Mobile Guide App | Rack lookup, QR scanning, scan history, notifications |

### 5.3 Transparent Verification Tray
- Enclosed, transparent tray with top-mounted RTDETR camera and built-in LED lighting.
- Purpose: remove background clutter, inconsistent lighting, and overlapping stock that would reduce AI counting accuracy on an open rack — maximizing match-rate reliability.
- Verification sequence: **Image Capture → AI Detection → Count & Verify → Result (Match/Mismatch)**.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Accuracy | AI product count must reliably match manual count under controlled tray lighting; mismatch rate should be validated during pilot. |
| Latency | Verification result (image capture → match/mismatch) should return in near real-time to avoid blocking worker workflow. |
| Reliability | ESP32-to-cloud data transmission must handle intermittent Wi-Fi gracefully (local buffering/retry). |
| Scalability | Architecture must scale across multiple racks, rooms, and warehouse branches without redesign. |
| Security | Worker RFID identity, stock data, and transaction logs must be stored and transmitted securely. |
| Auditability | Every transaction (matched or mismatched) must be fully traceable with labour, rack, product, quantity, time, and status. |
| Maintainability | Shared power supply and simple hardware chain should minimize installation/maintenance overhead. |

---

## 7. Key Features Summary

- Labour entry tracking via RFID
- Rack identification using QR codes
- Manual RFID product scan logging
- AI camera verification using RTDETR
- Enclosed transparent verification tray
- Automatic mismatch alerts
- Real-time stock monitoring
- Centralised data logs & reports
- Employee mobile guide
- Secure, accurate, low-manual-error system

---

## 8. Success Metrics

- Reduction in stock discrepancies vs. current manual-only process.
- Percentage of transactions auto-verified (MATCH) vs. flagged (MISMATCH) during pilot.
- Time-to-detection for stock discrepancies (should approach real-time).
- Dashboard adoption rate among supervisors/management.
- Reduction in time-to-locate products by warehouse staff (via mobile guide).

---

## 9. Rollout Plan

1. **Pilot** — Deploy on a single rack cluster to validate AI counting accuracy under real warehouse conditions.
2. **Integration** — Connect the ESP32 data feed with the company's existing inventory database.
3. **Rollout** — Deploy the mobile guide to warehouse staff and the dashboard to supervisors.
4. **Scale** — Expand tray verification points across all racks once pilot results are confirmed.

---

## 10. Open Questions / Risks

- What is the acceptable mismatch/false-alert rate before the system is considered pilot-successful?
- How are mismatches resolved operationally (who reviews, what's the escalation path)?
- What happens to throughput if every item must pass through a single verification tray per rack cluster (potential bottleneck)?
- Integration approach/API contract for the "existing inventory database" is not yet defined.
- Multi-item counting accuracy when products are stacked/overlapping inside the tray needs validation.
- Offline/degraded-connectivity behavior for ESP32 controllers is not yet specified.

---

## 11. Out of Scope (This Phase)

- Automated reordering/procurement triggers.
- Open-rack (non-tray) AI product recognition.
- Cross-warehouse inventory transfer workflows.
