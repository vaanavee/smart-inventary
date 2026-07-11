# Demo World — WisRight Inventory (QR + RFID Movement Tracker)

One coherent, fictional demo world reused verbatim on every screen. Static mockup — nothing is real.

## Brand / tenant
- **Name:** WisRight Inventory  · logo glyph **WR**
- **Sub / tagline:** Warehouse Ops · Chennai
- **Today:** 10 Jul 2026 (Fri)
- **Locale / units:** items / units (no currency). Times in IST, 24h `HH:MM`.
- **ID prefixes:** products `PRD-####`, employees `EMP-###`, movements `MOV-######`, RFID devices `ESP-D##`.
- **Low-stock threshold:** < 50 units (global, every product).

## Logged-in operator (topbar + audit lines, tenant pages)
- **Karthik Rajan** · initials **KR** · **Warehouse Supervisor** (admin).

## Employees (each mapped to a physical RFID card UID — reused from the real firmware roster)
| Emp ID | Name | RFID card | Role | Home room | Status |
|---|---|---|---|---|---|
| EMP-101 | Vishali Nair | `4E500E06` | Picker | Room 1 | Active |
| EMP-102 | Suraj Menon | `CC392B1F` | Picker | Room 2 | Active |
| EMP-103 | Vishal Kumar | `B3122A22` | Loader | Room 1 | Active |
| EMP-104 | Vaanavee R. | `0EB46F06` | Supervisor | Room 3 | Active |
| EMP-105 | Arjun Das | `7A2F1C09` | Picker | Room 2 | Active |
| EMP-106 | Meena Iyer | `1B9E4D22` | Picker | Room 3 | Inactive |

## Locations (Room → Rack, each room mapped to one ESP32 door reader)
| Room | Purpose | RFID device | Reader status | Racks |
|---|---|---|---|---|
| Room 1 | Fasteners & Hardware | `ESP-D01` | Online | A, B, C, D, E |
| Room 2 | Power Tools | `ESP-D02` | Online | A, B, C |
| Room 3 | Electricals | `ESP-D03` | Offline (12 min) | A, B, C, D |

## Products (catalog; hero record carried across every screen)
- **HERO:** `PRD-0412` **Bosch GSB 12V Cordless Drill** · Power Tools · Room 2 / Rack A · **stock 34** (LOW, min 50) · unit: pcs.
- `PRD-0188` M8 Hex Bolts (Box of 100) · Fasteners · Room 1 / Rack B · stock 240 · pcs
- `PRD-0207` 2.5mm² Copper Wire Spool · Electricals · Room 3 / Rack C · stock 42 (LOW) · rolls
- `PRD-0355` Makita Angle Grinder · Power Tools · Room 2 / Rack B · stock 18 (LOW) · pcs
- `PRD-0421` PVC Conduit Pipe 25mm · Electricals · Room 3 / Rack A · stock 610 · pcs
- `PRD-0509` Stainless Washers M8 · Fasteners · Room 1 / Rack A · stock 1,180 · pcs
- `PRD-0533` LED Panel 18W · Electricals · Room 3 / Rack D · stock 27 (LOW) · pcs
- `PRD-0560` Cordless Impact Driver · Power Tools · Room 2 / Rack C · stock 9 (LOW) · pcs
- filler rows ID-only in long tables.

## Canonical numbers (one value per fact, reused verbatim everywhere)
- Total products: **248** · Total employees: **6** (5 active) · Rooms: **3** · Racks: **12**.
- Movements today: **37** (22 OUT · 9 IN · 6 Transfer).
- Low-stock products (< 50): **6** — Drill 34, Copper Wire 42, Grinder 18, LED Panel 27, Impact Driver 9, + PRD-0771 31.
- Currently in rooms now: Room 1 → Vishali (in since 09:12), Room 2 → Arjun (09:41), Room 3 → empty.
- Unknown-person alert (open): Room 2, 09:47 — person on CCTV with no matching RFID tap.

## Hero movement (carried in feed / report / reconciliation)
- `MOV-004821` — **Vishali Nair** took **Bosch GSB 12V Drill** (PRD-0412) · **OUT ×3** · Room 2 Rack A → Dispatch · **10 Jul 09:14** · match **RFID ✓ / QR ✓ / CCTV ✓** (fully verified).
- `MOV-004822` — **Arjun Das** · Makita Grinder (PRD-0355) · Transfer ×2 · Room 2 Rack B → Room 1 Rack D · 09:41 · **RFID ✓ / QR ✓ / CCTV ✓**.
- `MOV-004823` — **(unmatched)** Copper Wire (PRD-0207) · OUT ×5 · Room 3 Rack C → Dispatch · 09:47 · **RFID ✗ / QR ✓ / CCTV ⚠** — QR movement with no door tap; CCTV caught a person → flagged.

## Match-status vocabulary
- **RFID ✓** door tap found · **QR ✓** in-app scan/movement recorded · **CCTV ✓** person sighted & identified.
- **✗** missing signal · **⚠** present but unmatched (e.g. unknown person on camera).
- Verdicts: **Verified** (all ✓) · **Review** (one ✗/⚠) · **Alert** (RFID ✗ + CCTV ⚠).

## Movement report (hero product PRD-0412, 01–10 Jul 2026)
- Material IN: **60** · Material OUT: **86** · Transfers in/out: **12 / 12** · Net change: **−26** → 34 on hand.
