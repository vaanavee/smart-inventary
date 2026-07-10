# Simple PRD — WisRight Inventory (QR + RFID Movement Tracker)

A lightweight inventory system where products carry QR codes and employees carry
RFID cards. Workers scan a product to record it moving **in**, **out**, or
**between locations**. A door RFID reader logs *who entered the room*, and CCTV
watches as a fallback — so every stock movement is cross-checked against **who
was actually there**. Managers watch stock levels, alerts, and movement history
on a dashboard.

**Three signals answer "who took this box?" and cross-check each other:**
1. **RFID at the door** — an ESP32 reader on each room detects which employee walked in (via their card number).
2. **QR scan + status update** — the same person scans the product and records the movement in the app.
3. **CCTV monitoring** — a camera watches the room as a fallback; if someone didn't tap their RFID, the camera still flags a person is present ("untapped / unknown person").

When all three agree, the movement is trusted. When they disagree (a QR movement with no RFID entry, or a person on camera who never tapped), it's flagged.

---

## 1. Who uses it

| Role | What they do |
|---|---|
| **Admin / Supervisor** | Manages products, employees, locations, RFID card & device mappings. Views dashboard, CCTV monitoring, attendance match, and reports. |
| **Employee / Worker** | Scans product QR codes to record movements. Searches where a product is. |

Both log in. Admin sees everything; Employee sees the Scanner, Product Search, and a read-only dashboard.

---

## 2. The core flow

1. Admin creates **Locations** (Rooms → Racks) and maps each room to its **RFID reader device number**.
2. Admin creates **Products** (with QR codes) and **Employees** (each mapped to their **RFID card number**).
3. A worker walks to a room — the **door RFID reader** logs their entry (employee + room + time).
4. The worker **scans** a product's QR code.
5. The app opens an **update page pre-filled** with that product's details.
6. Worker chooses the action — **Material IN**, **Material OUT**, or **Transfer** (from-location → to-location) — enters a **quantity**, and saves.
7. The system **cross-checks** the movement against the RFID door entry and the CCTV sighting for that room.
8. Stock counts update; the movement is logged (who, what, from/to, how many, when) with a **match status** (RFID ✓ / QR ✓ / CCTV ✓).
9. Managers see it on the **Dashboard**, review mismatches on the **Attendance Match** page, watch rooms on **CCTV Monitoring**, and pull a **Movement Report** for any product.

---

## 3. Pages / Features

### 3.1 Login
- One screen, two tabs: **Admin** and **Employee**. Simple username/password.

### 3.2 Dashboard (read-only overview)
- **Recent Employee Tracking** — live feed of movements: *employee · product · from → to · type · qty · time*, each row showing **match badges (RFID ✓ / QR ✓ / CCTV ✓)** with mismatches highlighted red.
- **Low-Stock Alerts** — every product currently **below 50 units**.
- **High Material-Out Products** — products with the most stock leaving (top movers out).
- **Unknown-Person Alerts** — CCTV detected someone who didn't tap RFID.
- Summary stat cards (total products, total employees, today's movements, active low-stock count, who's currently in each room).

### 3.3 Employees (Admin — CRUD)
- List, add, edit, delete employees.
- Fields: name, employee ID, **RFID card number**, department, role, status (active/inactive).

### 3.4 Products (Admin — CRUD + QR)
- List, add, edit, delete products.
- Fields: product name, product ID/SKU, category, unit, current quantity, room, rack.
- **Generate QR** button per product → printable/downloadable QR that encodes the product identity.

### 3.5 Locations (Admin — CRUD, hierarchy + device mapping)
- Manage **Rooms**, and **Racks inside each room** (add/edit/delete at both levels).
- Each **Room** carries its **RFID reader (ESP32) device number** and shows the reader's online/offline status.
- Simple tree/expandable view: Room → its Racks.

### 3.6 QR Scanner (Employee)
- Opens the device camera and scans a product QR (also supports uploading a QR image).
- On a successful scan → **Update Movement** page opens, pre-filled with the product's name, ID, current location, and current stock.
- Worker selects **IN / OUT / Transfer**, picks the **from** and **to** location (Transfer), enters **quantity**, and confirms.
- Confirmation screen summarizes what was recorded, including its match status.

### 3.7 Product Search (Employee + Admin)
- Search a product by name or ID.
- Shows **where the product is** — which room, which rack, and current quantity.

### 3.8 CCTV Monitoring (Admin)
- **Per-room camera grid** — one tile per room (camera placeholder; simulated feed in the mockup).
- Each tile shows detected people, **who tapped RFID vs. unknown**, and raises an **unknown-person alert** when someone is present without a matching RFID entry.
- Current people-in-room count per tile.

### 3.9 Attendance Match / Reconciliation (Admin)
- Lists each room session and reconciles the three signals: **RFID door entry** vs **QR scan/movement** vs **CCTV sighting**.
- Each row gets a **matched / unmatched verdict** (e.g. "QR movement with no RFID entry", "person on camera, no card tap", "all matched").
- Filterable by room, employee, date, and status (matched / mismatched).

### 3.10 Movement Report (Admin)
- Search a specific product, pick a **date range**.
- Shows every movement for that product in the range, plus **totals: Material IN, Material OUT, net change**, and where it moved.
- Exportable (CSV) — optional in the mockup.

---

## 4. Key rules & mappings

- **Low stock = quantity below 50** (same threshold for every product).
- **Employee ↔ RFID card number** — each employee is mapped to their physical card UID.
- **Room ↔ RFID device number** — each room is mapped to its door ESP32 reader (set on the Locations page).
- Every movement records: **employee, product, action (IN/OUT/Transfer), from-location, to-location, quantity, timestamp, and match status (RFID / QR / CCTV)**.
- A QR code is **self-contained** — scanning it identifies the product without a lookup service.
- Location hierarchy is exactly **two levels: Room → Rack**.
- CCTV is a **fallback identity check** — it catches people who moved stock without tapping RFID.

---

## 5. Out of scope (this version)

- AI product-count verification (no RT-DETR box counting — CCTV is only for person presence).
- Multi-warehouse or multi-branch hierarchy (single site, Rooms → Racks only).
- Automatic reordering / procurement.
- Real backend, live cameras & data persistence for the **mockup** (screens use sample/simulated data).

---

## 6. Screen list (for the mockup)

1. Login
2. Dashboard (with match badges + unknown-person alerts)
3. Employees (list + add/edit modal, with RFID card number)
4. Products (list + add/edit modal + QR view)
5. Locations (Rooms & Racks + RFID device number)
6. QR Scanner → Update Movement → Confirmation
7. Product Search
8. CCTV Monitoring (per-room camera grid)
9. Attendance Match / Reconciliation
10. Movement Report
