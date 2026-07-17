# Hardware Wiring — Entrance Unit & Rack Unit

Two identical sets of **ESP32 Dev Board + MFRC522 (RC522) RFID reader**.
Both boards use the exact same pin mapping, so they can be wired and
double-checked the same way.

## Bill of Materials (per set, x2 total)

| Qty | Component |
|-----|-----------|
| 1 | ESP32 Dev Board (30/38-pin) |
| 1 | MFRC522 (RC522) RFID reader module |
| 1 | RFID tag/card per employee |
| — | Jumper wires (female-to-female if using dev board headers) |

## Pin Connections (MFRC522 & OLED → ESP32)

### MFRC522 RFID Reader

| MFRC522 Pin | ESP32 Pin | Notes |
|-------------|-----------|-------|
| SDA (SS)    | GPIO5     | Chip select — matches `SS_PIN` in code |
| SCK         | GPIO18    | SPI clock (hardware VSPI default) |
| MOSI        | GPIO23    | SPI data out (hardware VSPI default) |
| MISO        | GPIO19    | SPI data in (hardware VSPI default) |
| IRQ         | *(not connected)* | Unused — polling mode, no interrupt wiring needed |
| GND         | GND       | Common ground |
| RST         | GPIO22    | Reset — matches `RST_PIN` in code |
| 3.3V        | 3.3V      | **Do not connect to 5V** — MFRC522 logic is 3.3V only |

### 0.96" I2C OLED Display

| OLED Pin | ESP32 Pin | Notes |
|----------|-----------|-------|
| VCC      | 3.3V      | Power |
| GND      | GND       | Ground |
| SDA      | GPIO21    | I2C Data |
| SCL      | GPIO17    | I2C Clock |

This mapping is identical for both the **Entrance Unit** and the **Rack Unit** — wire both sets the same way.

## Wiring Diagram (per unit)

```
        MFRC522                         ESP32 Dev Board
      ┌───────────┐                   ┌───────────────────┐
      │   SDA/SS  │──────────────────▶│ GPIO5             │
      │   SCK     │──────────────────▶│ GPIO18            │
      │   MOSI    │──────────────────▶│ GPIO23            │
      │   MISO    │◀──────────────────│ GPIO19            │
      │   IRQ     │      (not used)   │                   │
      │   GND     │──────────────────▶│ GND               │
      │   RST     │──────────────────▶│ GPIO22            │
      │   3.3V    │◀──────────────────│ 3.3V              │
      └───────────┘                   │                   │
                                      │                   │
        OLED Display                  │                   │
      ┌───────────┐                   │                   │
      │   VCC     │◀──────────────────│ 3.3V              │
      │   GND     │──────────────────▶│ GND               │
      │   SDA     │──────────────────▶│ GPIO21            │
      │   SCL     │──────────────────▶│ GPIO17            │
      └───────────┘                   └───────────────────┘
```

## Power

- Power each ESP32 via its USB port (from a PC, USB power brick, or
  power bank) — this also powers the attached MFRC522 through the
  board's 3.3V rail.
- The two units are physically separate and do not share power or
  ground. Both join your **regular WiFi network** (not a standalone
  Access Point) and both talk directly to the Node backend's REST API
  over HTTPS at the production domain — see
  [EntranceUnit.ino](EntranceUnit/EntranceUnit.ino) and
  [RackUnit.ino](RackUnit/RackUnit.ino): fill in `WIFI_SSID` and
  `WIFI_PASSWORD` near the top of each file before flashing.
  `SERVER_HOST` is preset to `api.wisright.com` (the public Node API,
  see `docker-compose.yml` → `node` → `SERVICE_FQDN_NODE_4000`) — only
  change it if you're testing against a local dev backend on your LAN
  instead (e.g. `192.168.x.x`, and switch `backendUrl()` back to
  `http://` with a `:4000` port in that case).

## Changing the pins

If your dev board's silkscreen uses different GPIO numbers, or you need
GPIO5/18/19/23/22 free for something else, update the matching
`#define SS_PIN` / `#define RST_PIN` at the top of each `.ino` file —
SCK/MOSI/MISO stay fixed to the ESP32's hardware VSPI pins unless you
also change the `SPI.begin(...)` call to remap them.

## Sanity check before powering on

- MFRC522 3.3V is **not** tolerant of 5V — confirm you're using the
  board's 3.3V pin, not VIN/5V.
- SDA and RST must go to distinct GPIOs (GPIO5 and GPIO22 here) —
  swapping them is a common wiring mistake that shows up as the reader
  never detecting a card.
- After wiring, open the Serial Monitor at **115200 baud** — both
  sketches print their WiFi status and IP on boot, which confirms the
  board itself is alive even before you test a tap.
