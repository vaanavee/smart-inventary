/*
  =====================================================================
  RFID ATTENDANCE SYSTEM (ESP32 + MFRC522) - CUMULATIVE SESSIONS
  =====================================================================
  4 registered users, each with their own RFID card UID.
  First tap  -> LOGIN  (records login time)
  Second tap -> LOGOUT (records logout time + total duration inside)
  Each user's timer runs completely independently, so two people can
  be logged in at the same time with no interference between them.

  Every completed login/logout pair is APPENDED to that user's
  session history (up to MAX_SESSIONS_PER_USER), instead of
  overwriting the previous record.

  A built-in web dashboard (served directly by the ESP32 itself, no
  external websites/CDNs) shows the full session history per user:
      User | # | Login | Logout | Duration | Status

  WIRING (MFRC522 -> ESP32 DevKit V1)
    SDA  -> GPIO15      SCK  -> GPIO18
    MOSI -> GPIO23      MISO -> GPIO19
    RST  -> GPIO21      3.3V -> 3.3V      GND -> GND

  WIFI (ESP32 runs as its own Access Point - no router needed)
    SSID     : InventoryESP32
    Password : Inventory123
    Dashboard: http://192.168.4.1/        <-- open this in a browser
                                                after connecting to the WiFi
  =====================================================================
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ---------------------------------------------------------------------
// PIN DEFINITIONS
// ---------------------------------------------------------------------
#define SS_PIN   15
#define RST_PIN  21
#define SCK_PIN  18
#define MISO_PIN 19
#define MOSI_PIN 23

// ---------------------------------------------------------------------
// WIFI ACCESS POINT CREDENTIALS
// ---------------------------------------------------------------------
const char *AP_SSID     = "InventoryESP32";
const char *AP_PASSWORD = "Inventory123";

// ---------------------------------------------------------------------
// REGISTERED USERS
// ---------------------------------------------------------------------
#define TOTAL_USERS 4
#define MAX_SESSIONS_PER_USER 20   // history ring buffer size per user

MFRC522 rfid(SS_PIN, RST_PIN);
WebServer server(80);

struct User {
  char name[16];
  char uid[12]; // stored as uppercase hex, no spaces, e.g. "4E500E06"
};

struct Session {
  char loginTime[10];   // HH:MM:SS
  char logoutTime[10];  // HH:MM:SS
  char duration[10];    // HH:MM:SS
  char status[5];       // "IN" or "OUT"
  unsigned long loginMillis;
};

// Registered users mapped to their real card UIDs
User users[TOTAL_USERS] = {
  {"Vishali",  "4E500E06"},
  {"Suraj",    "CC392B1F"},
  {"Vishal",   "B3122A22"},
  {"Vaanavee", "0EB46F06"}
};

// Cumulative session history per user (ring buffer)
Session history[TOTAL_USERS][MAX_SESSIONS_PER_USER];
int sessionCount[TOTAL_USERS] = {0, 0, 0, 0};   // total sessions ever recorded
int sessionHead[TOTAL_USERS]  = {0, 0, 0, 0};   // next write index (ring buffer)

// ---------------------------------------------------------------------
// FUNCTION PROTOTYPES
// ---------------------------------------------------------------------
String getUIDString(MFRC522::Uid &uidStruct);
int findUserIndex(const String &uid);
String getCurrentTimeString();
String calculateDuration(unsigned long loginMs, unsigned long logoutMs);
void handleTap(const String &uid);
Session *currentOpenSession(int idx);
void printStatus(int idx);
void handleRoot();
void handleData();
void handleNotFound();

// =====================================================================
// SETUP
// =====================================================================
void setup() {
  // Prevent silent reboots caused by momentary voltage dips when the
  // RFID reader and WiFi radio both draw current at the same time.
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(200);
  Serial.println("\n==== RFID Attendance System Booting ====");

  // ---- RFID init ----
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  rfid.PCD_Init();
  Serial.println("[OK] MFRC522 initialized.");

  // ---- WiFi Access Point init ----
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(100);
  WiFi.mode(WIFI_AP);
  delay(100);

  bool apOK = WiFi.softAP(AP_SSID, AP_PASSWORD, 1, 0, 4);
  if (apOK) {
    delay(300);
    Serial.print("[OK] WiFi AP started. SSID: ");
    Serial.println(AP_SSID);
    Serial.print("[OK] Password  : ");
    Serial.println(AP_PASSWORD);
    Serial.print("[OK] Dashboard URL: http://");
    Serial.println(WiFi.softAPIP());
  } else {
    Serial.println("[ERROR] WiFi AP failed to start. Try a better USB power source.");
  }

  // ---- Web routes ----
  server.on("/", HTTP_GET, handleRoot);
  server.on("/data", HTTP_GET, handleData);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("[OK] Web server started.");
  Serial.println("==== System ready. Tap a card. ====");
}

// =====================================================================
// LOOP
// =====================================================================
void loop() {
  server.handleClient();

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  String uid = getUIDString(rfid.uid);
  handleTap(uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// =====================================================================
// UID HELPERS
// =====================================================================
String getUIDString(MFRC522::Uid &uidStruct) {
  String result = "";
  for (byte i = 0; i < uidStruct.size; i++) {
    if (uidStruct.uidByte[i] < 0x10) result += "0";
    result += String(uidStruct.uidByte[i], HEX);
  }
  result.toUpperCase();
  result.trim();
  return result;
}

int findUserIndex(const String &uid) {
  String cleanUid = uid;
  cleanUid.trim();
  for (int i = 0; i < TOTAL_USERS; i++) {
    if (cleanUid.equalsIgnoreCase(users[i].uid)) {
      return i;
    }
  }
  return -1;
}

// =====================================================================
// TIME HELPERS (software clock based on millis() since boot)
// =====================================================================
String getCurrentTimeString() {
  unsigned long totalSeconds = millis() / 1000UL;
  int hours   = (int)((totalSeconds / 3600UL) % 24UL);
  int minutes = (int)((totalSeconds / 60UL) % 60UL);
  int seconds = (int)(totalSeconds % 60UL);
  char buf[10];
  sprintf(buf, "%02d:%02d:%02d", hours, minutes, seconds);
  return String(buf);
}

String calculateDuration(unsigned long loginMs, unsigned long logoutMs) {
  unsigned long diffMs = (logoutMs >= loginMs) ? (logoutMs - loginMs) : 0;
  unsigned long totalSeconds = diffMs / 1000UL;
  int hours   = (int)(totalSeconds / 3600UL);
  int minutes = (int)((totalSeconds % 3600UL) / 60UL);
  int seconds = (int)(totalSeconds % 60UL);
  char buf[10];
  sprintf(buf, "%02d:%02d:%02d", hours, minutes, seconds);
  return String(buf);
}

// Returns pointer to the currently-open (status "IN") session for a user,
// or nullptr if that user has no open session right now.
Session *currentOpenSession(int idx) {
  if (sessionCount[idx] == 0) return nullptr;
  int lastIdx = (sessionHead[idx] - 1 + MAX_SESSIONS_PER_USER) % MAX_SESSIONS_PER_USER;
  Session *s = &history[idx][lastIdx];
  if (strcmp(s->status, "IN") == 0) return s;
  return nullptr;
}

// =====================================================================
// TAP HANDLER (independent login/logout per user, cumulative history)
// =====================================================================
void handleTap(const String &uid) {
  int idx = findUserIndex(uid);

  if (idx == -1) {
    Serial.println("====================================");
    Serial.println("Unknown Card");
    Serial.print("Scanned UID: ");
    Serial.println(uid);
    Serial.println("====================================");
    return;
  }

  Session *open = currentOpenSession(idx);

  if (open == nullptr) {
    // ---- LOGIN (start a brand-new session entry) ----
    int writeIdx = sessionHead[idx];
    Session &s = history[idx][writeIdx];

    String now = getCurrentTimeString();
    strncpy(s.loginTime, now.c_str(), sizeof(s.loginTime) - 1);
    s.loginTime[sizeof(s.loginTime) - 1] = '\0';
    s.logoutTime[0] = '\0';
    s.duration[0]   = '\0';
    strcpy(s.status, "IN");
    s.loginMillis = millis();

    sessionHead[idx] = (sessionHead[idx] + 1) % MAX_SESSIONS_PER_USER;
    if (sessionCount[idx] < MAX_SESSIONS_PER_USER) sessionCount[idx]++;

    printStatus(idx, &s);
  } else {
    // ---- LOGOUT (close the currently open session entry) ----
    String now = getCurrentTimeString();
    strncpy(open->logoutTime, now.c_str(), sizeof(open->logoutTime) - 1);
    open->logoutTime[sizeof(open->logoutTime) - 1] = '\0';

    String dur = calculateDuration(open->loginMillis, millis());
    strncpy(open->duration, dur.c_str(), sizeof(open->duration) - 1);
    open->duration[sizeof(open->duration) - 1] = '\0';
    strcpy(open->status, "OUT");

    printStatus(idx, open);
  }
}

void printStatus(int idx, Session *s) {
  Serial.println("====================================");
  Serial.print("User          : "); Serial.println(users[idx].name);
  Serial.print("Status        : "); Serial.println(s->status);
  Serial.print("Login Time    : "); Serial.println(s->loginTime);
  Serial.print("Logout Time   : "); Serial.println(s->logoutTime);
  Serial.print("Total Duration: "); Serial.println(s->duration);
  Serial.print("Session #     : "); Serial.println(sessionCount[idx]);
  Serial.println("====================================");
}

// =====================================================================
// WEB DASHBOARD (self-contained HTML/CSS/JS, no external links)
// =====================================================================
void handleRoot() {
  String html =
    "<!DOCTYPE html><html><head><meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<title>RFID Attendance Dashboard</title>"
    "<style>"
    "body{font-family:Arial,Helvetica,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:20px;}"
    "h1{text-align:center;color:#38bdf8;margin-bottom:20px;}"
    "h2{color:#38bdf8;margin:24px 0 8px;}"
    "table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;margin-bottom:16px;}"
    "th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #334155;}"
    "th{background:#0ea5e9;color:#ffffff;}"
    "tr:last-child td{border-bottom:none;}"
    ".in{color:#22c55e;font-weight:bold;}"
    ".out{color:#f87171;font-weight:bold;}"
    ".footer{text-align:center;margin-top:16px;color:#64748b;font-size:13px;}"
    "</style></head><body>"
    "<h1>RFID Attendance Dashboard</h1>"
    "<div id='content'></div>"
    "<div class='footer'>Auto-refreshes every 2 seconds</div>"
    "<script>"
    "function refresh(){"
    "fetch('/data').then(r=>r.json()).then(users=>{"
    "var html='';"
    "users.forEach(u=>{"
    "html+='<h2>'+u.name+'</h2>';"
    "html+='<table><thead><tr><th>#</th><th>Status</th><th>Login</th><th>Logout</th><th>Duration</th></tr></thead><tbody>';"
    "if(u.sessions.length===0){"
    "html+='<tr><td colspan=\"5\">No sessions yet</td></tr>';"
    "}else{"
    "u.sessions.forEach((s,i)=>{"
    "var cls=(s.status=='IN')?'in':'out';"
    "html+='<tr><td>'+(i+1)+'</td><td class=\"'+cls+'\">'+s.status+'</td><td>'+s.login+'</td><td>'+s.logout+'</td><td>'+s.duration+'</td></tr>';"
    "});"
    "}"
    "html+='</tbody></table>';"
    "});"
    "document.getElementById('content').innerHTML=html;"
    "});"
    "}"
    "refresh();setInterval(refresh,2000);"
    "</script></body></html>";

  server.send(200, "text/html", html);
}

// GET /data -> JSON used by the dashboard's JavaScript to refresh the table.
// Returns each user's FULL session history (oldest first), not just the last one.
void handleData() {
  DynamicJsonDocument doc(8192);
  JsonArray arr = doc.to<JsonArray>();

  for (int i = 0; i < TOTAL_USERS; i++) {
    JsonObject obj = arr.createNestedObject();
    obj["name"] = users[i].name;
    JsonArray sessArr = obj.createNestedArray("sessions");

    int count = sessionCount[i];
    int start = (count < MAX_SESSIONS_PER_USER) ? 0 : sessionHead[i];

    for (int n = 0; n < count; n++) {
      int readIdx = (start + n) % MAX_SESSIONS_PER_USER;
      Session &s = history[i][readIdx];
      JsonObject sessObj = sessArr.createNestedObject();
      sessObj["status"]   = s.status;
      sessObj["login"]    = s.loginTime;
      sessObj["logout"]   = s.logoutTime;
      sessObj["duration"] = s.duration;
    }
  }

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

void handleNotFound() {
  server.send(404, "text/plain", "Not Found");
}
