/*
  Entrance Unit - ESP32 + MFRC522
  ---------------------------------
  Handles employee LOGIN / LOGOUT via RFID tap at the entrance.

  - 1st tap of a card  -> creates a new session (login time recorded).
  - 2nd tap (same card) -> closes that same session (logout time recorded).
  - Multiple employees can be logged in at the same time (parallel sessions).
  - A tap while already logged in only ever logs THAT employee out
    (duplicate login while active is not possible, matching the same tap).

  Also runs a small HTTP server so the Rack Unit can report
  "employee X accessed rack Y" for whichever employee is currently
  logged in with that RFID UID.

  NETWORKING (for now): this unit hosts its OWN WiFi network
  (Access Point mode) instead of joining a router. The Rack Unit
  connects directly to it. No internet access on this network, so
  NTP won't sync -> timestamps fall back to "time since boot".

    SSID     : InventoryESP32
    Password : Inventory123
    Entrance Unit IP (fixed by ESP32 in AP mode): 192.168.4.1

  Wiring (MFRC522 -> ESP32):
    SDA/SS  -> GPIO5
    SCK     -> GPIO18
    MOSI    -> GPIO23
    MISO    -> GPIO19
    RST     -> GPIO22
    3.3V    -> 3.3V
    GND     -> GND

  Libraries required (Arduino Library Manager):
    - MFRC522 (by GithubCommunity)
    - ESP32 board package (provides WiFi.h, WebServer.h, time.h)
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WebServer.h>
#include <time.h>

// ---------------- WiFi (this unit is its own Access Point) ----------------
const char* AP_SSID     = "InventoryESP32";
const char* AP_PASSWORD = "Inventory123"; // must be 8+ characters

// ---------------- NTP (for readable timestamps) ----------------
const char* NTP_SERVER        = "pool.ntp.org";
const long  GMT_OFFSET_SEC    = 5.5 * 3600; // IST; change to your timezone
const int   DAYLIGHT_OFFSET_SEC = 0;

// ---------------- RFID ----------------
#define SS_PIN  5
#define RST_PIN 22
MFRC522 rfid(SS_PIN, RST_PIN);

// ---------------- Session storage ----------------
#define MAX_EMPLOYEES   20   // how many employees can be logged in / tracked at once
#define MAX_RACK_VISITS 10   // rack-access entries kept per session

struct EmployeeSession {
  bool   inUse = false;      // slot occupied (session exists, open or closed)
  bool   active = false;     // true while employee is logged in (between taps)
  String uid;
  String loginTime;
  String logoutTime;
  String rackHistory[MAX_RACK_VISITS];
  int    rackVisitCount = 0;
};

EmployeeSession sessions[MAX_EMPLOYEES];

WebServer server(80);

// ---------------- Helpers ----------------
String getTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "t+" + String(millis()); // NTP not synced yet, fall back to uptime
  }
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buf);
}

String readUID() {
  String uidStr = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(rfid.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();
  return uidStr;
}

// Find a session by UID. If onlyActive is true, only currently logged-in
// sessions match (used to tell login-tap apart from logout-tap).
int findSessionIndex(const String &uid, bool onlyActive) {
  for (int i = 0; i < MAX_EMPLOYEES; i++) {
    if (sessions[i].inUse && sessions[i].uid == uid) {
      if (!onlyActive || sessions[i].active) return i;
    }
  }
  return -1;
}

int findFreeSlot() {
  for (int i = 0; i < MAX_EMPLOYEES; i++) {
    if (!sessions[i].inUse) return i;
  }
  return -1;
}

void printSession(int idx) {
  Serial.println("------------------------------------");
  Serial.println("Employee UID   : " + sessions[idx].uid);
  Serial.println("Login Time     : " + sessions[idx].loginTime);
  Serial.println("Logout Time    : " + sessions[idx].logoutTime);
  Serial.println("Rack Access History:");
  if (sessions[idx].rackVisitCount == 0) {
    Serial.println("  (none)");
  } else {
    for (int j = 0; j < sessions[idx].rackVisitCount; j++) {
      Serial.println("  " + sessions[idx].rackHistory[j]);
    }
  }
  Serial.println("------------------------------------");
}

// ---------------- HTTP endpoint for the Rack Unit ----------------
// GET /rackAccess?uid=XXXXXXXX&rack=Stationery
void handleRackAccess() {
  if (!server.hasArg("uid") || !server.hasArg("rack")) {
    server.send(400, "text/plain", "MISSING_PARAMS");
    return;
  }

  String uid = server.arg("uid");
  uid.toUpperCase();
  String rack = server.arg("rack");

  int idx = findSessionIndex(uid, true); // must have an ACTIVE login session
  if (idx == -1) {
    Serial.println("[RACK] Rejected: UID " + uid + " has no active login session.");
    server.send(403, "text/plain", "NOT_LOGGED_IN");
    return;
  }

  String ts = getTimestamp();
  String entry = rack + " @ " + ts;

  if (sessions[idx].rackVisitCount < MAX_RACK_VISITS) {
    sessions[idx].rackHistory[sessions[idx].rackVisitCount++] = entry;
  }

  Serial.println("[RACK] " + uid + " accessed " + rack + " at " + ts);
  server.send(200, "text/plain", "OK");
}

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();

  WiFi.softAP(AP_SSID, AP_PASSWORD);
  Serial.print("Access Point started. SSID: ");
  Serial.print(AP_SSID);
  Serial.print("  Password: ");
  Serial.println(AP_PASSWORD);
  Serial.print("Entrance Unit IP: ");
  Serial.println(WiFi.softAPIP()); // 192.168.4.1 by default

  // No internet on this network, so this will silently fail and
  // getTimestamp() will fall back to "time since boot" - that's expected.
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);

  server.on("/rackAccess", HTTP_GET, handleRackAccess);
  server.begin();

  Serial.println("Entrance Unit ready. Waiting for RFID taps...");
}

void loop() {
  server.handleClient();

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = readUID();
  int activeIdx = findSessionIndex(uid, true);

  if (activeIdx == -1) {
    // ---- First tap for this card -> LOGIN ----
    int slot = findFreeSlot();
    if (slot == -1) {
      Serial.println("ERROR: No free session slots. Increase MAX_EMPLOYEES.");
    } else {
      sessions[slot].inUse   = true;
      sessions[slot].active  = true;
      sessions[slot].uid     = uid;
      sessions[slot].loginTime  = getTimestamp();
      sessions[slot].logoutTime = "";
      sessions[slot].rackVisitCount = 0;

      Serial.println("LOGIN  -> UID: " + uid + " at " + sessions[slot].loginTime);
    }
  } else {
    // ---- Second tap, same card -> LOGOUT (closes only this employee's session) ----
    sessions[activeIdx].logoutTime = getTimestamp();
    sessions[activeIdx].active = false;

    Serial.println("LOGOUT -> UID: " + uid + " at " + sessions[activeIdx].logoutTime);
    printSession(activeIdx);

    // Free the slot so the same card can start a fresh session next time.
    sessions[activeIdx].inUse = false;
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(1000); // simple debounce so one tap isn't read twice
}
