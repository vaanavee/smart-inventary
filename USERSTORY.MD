# WisRight Smart Inventory — User Stories

Three people rely on this system every shift: the person on the floor, the person running the
building, and the person who owns the stock. This document lays out what each of them needs, in
their own words, and exactly which part of the WisRight system already delivers it.

**Personas:** Employee (floor operator) · Admin (control room) · Shop Owner (the business)

**Data flow:** RFID tap (ESP32 — entrance / rack) → Node backend (`room_entries`, `rack_scans`) →
Dashboard (live, per-role views) → QR code (leaves the building with the box)

---

## 1. Employee

Works a shift, picks and moves stock, needs answers fast and a record that protects them if
something is questioned later.

### Find a product
As an **Employee**, when someone asks for a pencil, I want to search for it and see exactly which
room and rack it's in — not go looking shelf by shelf.

> **System:** Product Guidance search matches by name or ID and returns `room + rack` straight from
> the catalog — e.g. `Pencil HB → Room 1 / Rack A`.

### Clock in / clock out
As an **Employee**, I want tapping my RFID card at the door to log my arrival and departure
automatically, so my hours are recorded without filling anything in.

> **System:** First tap opens a `room_entries` row (login), second tap closes it (logout) with
> duration. Every shift is a new row — full history kept, nothing overwritten.

### Rack accountability
As an **Employee**, I want my rack tap to log what I took and when, so there's a clean record if
anyone asks about missing stock later.

> **System:** Rack taps are rejected (403) unless I already checked in at the entrance — activity
> always traces back to a real shift, not a stray card.

### Scan before you move it
As an **Employee**, I want to scan a box's QR code and instantly see what it is, how much is
inside, and where it came from — so I never move the wrong one.

> **System:** QR Scanner decodes name, quantity, and origin directly off the code — works even
> without a network lookup.

---

## 2. Admin

Runs the day-to-day: knows where everyone is, where every product moved, and whether the camera
actually agrees with what's on the shelf.

### Who's in, right now
As an **Admin**, I want to see who is currently inside which room, live, so I always know where my
team is without walking the floor.

> **System:** "Currently Inside" pulls every `room_entries` row with no exit time yet — updates as
> people tap in and out.

### Attendance log
As an **Admin**, I want a per-day record of every employee's entry, exit, and duration, so I can
review attendance for any date without asking anyone.

> **System:** Entry/Exit History, filterable by date, showing
> `entry_time · exit_time · duration · status` per employee.

### Who took what, from where
As an **Admin**, I want to know exactly which employee took a product, from which room and rack,
and at what time, so any stock question traces straight to a person and a timestamp.

> **System:** Recent Rack Taps joins each RFID tap (`employee · room · rack · time`) with the live
> products stocked at that exact location.

### Stock levels & reorder flags
As an **Admin**, I want to see current stock per product and get warned when something is running
low, so I can reorder before we actually run out.

> **System:** Stock Monitoring totals units per room/rack; anything under 50 units flags
> low-stock, zero flags out-of-stock, surfaced on the Home dashboard too.

### Verified, not guessed
As an **Admin**, I want to know whether a product was actually verified by the camera or just
assumed, so I can trust what the system tells me is on the shelf.

> **System:** RT-DETR reports a confidence score per detection; anything it can't map to the
> catalog shows as `Unknown` instead of being silently guessed.

### Generate a QR, either way
As an **Admin**, I want to generate a QR code for a catalog product, or type in a brand-new one
manually — origin, name, and stock count — so every box leaving or entering the warehouse is
scannable.

> **System:** QR Generator's `From Catalog` and `Manual Entry` modes both produce a printable,
> downloadable code.

---

## 3. Shop Owner

Doesn't run shifts, but needs the same ground truth as Admin — at a glance, and far enough ahead
to buy before the shelf goes empty.

### Check it myself
As a **Shop Owner**, I want to look up a product like a pencil and see exactly where it is,
myself — not relay the question through staff.

> **System:** The same Product Guidance search available to staff, open to my account too.

### Stock health at a glance
As a **Shop Owner**, I want one view of total stock, what's low, and what's out, so I know the
state of my inventory without digging.

> **System:** Home dashboard + Stock Monitoring totals: products, units, low-stock count,
> out-of-stock count.

### What to buy next
As a **Shop Owner**, I want visibility into stock trends over time, so I know what to purchase in
the coming days before it becomes urgent.

> **System:** Analytics tracks movement trends per product, feeding low-stock projections ahead of
> the reorder point.

### Audit without a middleman
As a **Shop Owner**, I want the same room-by-room, product-by-product visibility as my Admin, so I
can personally check on the shop without going through anyone.

> **System:** Employee, Stock, and rack-tap views are the same ones Admin uses — one source of
> truth for both roles.

---

## Capability matrix

| Capability | Employee | Admin | Shop Owner |
|---|:---:|:---:|:---:|
| Find a product's room & rack | ✓ | ✓ | ✓ |
| RFID login / logout (cumulative) | ✓ | ✓ | — |
| Live "who's in which room" | — | ✓ | ✓ |
| Which employee took which product, room, rack, date & time | — | ✓ | ✓ |
| Current stock levels per room | ✓ | ✓ | ✓ |
| Low-stock / reorder warnings | — | ✓ | ✓ |
| Purchase-planning trends | — | ✓ | ✓ |
| Camera-verified product match + confidence | — | ✓ | ✓ |
| Generate QR — from catalog | — | ✓ | ✓ |
| Generate QR — manual entry (origin, product, stock) | — | ✓ | ✓ |
| Scan QR to view product details | ✓ | ✓ | ✓ |
