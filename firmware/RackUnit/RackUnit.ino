/*
  Rack Unit - ESP32 + MFRC522
  ---------------------------------
  Sits at a specific rack. When an employee taps their card here, this unit
  reports the tap directly to the real Node backend:

    POST /api/rfid/rack-scan { rfidTag, rack, room }

  The backend rejects the tap (403) if that employee doesn't currently have
  an open entrance session - they must tap the EntranceUnit's reader first.

  A tap TOGGLES a rack session, exactly like the entrance reader does for the
  room: the first tap is a rack LOGIN (HTTP 201, status "At Rack") and the
  same employee's next tap at this rack is the rack LOGOFF (HTTP 200), which
  comes back with the time spent at the rack.

  Like the EntranceUnit this unit also:
    - POSTs /rfid/heartbeat every 30s so it shows up in the dashboard's
      Device Admin tab (without this it is invisible to the dashboard), and
    - serves its own admin console on port 80 with live scan history.

  This unit has no OLED - it is a headless reader; all diagnostics are on
  Serial and on its web console.
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <time.h>
#include <ArduinoJson.h>

// ---------------- WiFi ----------------
const char* WIFI_SSID     = "Vishali";
const char* WIFI_PASSWORD = "9884727652";

// ---------------- Backend ----------------
// Routed through the dashboard's own nginx proxy (same host that already
// works in a browser at https://inventory.wisright.com) rather than a
// dedicated api.wisright.com subdomain - that domain has no DNS record yet,
// which made every request fail with HTTP -1 (couldn't even resolve the
// hostname). This path works today with zero extra DNS/Coolify setup:
//   https://inventory.wisright.com/monitor-api/*  ->  node:4000/api/*
// Switch SERVER_HOST/API_PREFIX back to "api.wisright.com" + "/api" once
// that subdomain has a real DNS record and SERVICE_FQDN_NODE_4000 is live.
const char* SERVER_HOST  = "inventory.wisright.com";
const char* API_PREFIX   = "/monitor-api";
const char* ROOM_NAME    = "Room 1";
// Must match the `rack` value used by products in this room, so a tap can be
// paired with what is actually stocked here.
const char* RACK_NAME    = "Rack 1";
// Key this unit is registered under in the dashboard's Device Admin tab.
const char* DEVICE_NAME  = "Rack Unit";

// ---------------- Web Server ----------------
WebServer server(80);

// ---------------- RFID (Dynamic Pins) ----------------
MFRC522* rfid = nullptr;
int detectedSS = -1;
int detectedRST = -1;

// Heartbeat tracking
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds

// NTP-synced wall-clock time (IST, UTC+5:30) so rack entries show a real time
// of day instead of "seconds since boot". Falls back to uptime if NTP hasn't
// synced yet (e.g. right after boot, before the first sync completes).
const long GMT_OFFSET_SEC = 5 * 3600 + 1800;
const int DAYLIGHT_OFFSET_SEC = 0;
const char* NTP_SERVER = "pool.ntp.org";

String getTimeString() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 200)) {
    unsigned long totalSeconds = millis() / 1000UL;
    char buf[16];
    sprintf(buf, "+%02lu:%02lu:%02lu", (totalSeconds / 3600) % 24, (totalSeconds / 60) % 60, totalSeconds % 60);
    return String(buf);
  }
  char buf[16];
  strftime(buf, sizeof(buf), "%H:%M:%S", &timeinfo);
  return String(buf);
}

// Recent Scans Ring Buffer. Unlike the entrance unit this also keeps the
// resolved employee name/id and the rack session duration returned by the
// backend, so the console answers "who was at this rack, and for how long".
struct ScanLog {
  String uid;
  String employee;
  String empId;
  String action;   // "Rack Login" / "Rack Logoff" / "Scan"
  String status;   // "Granted", "Denied (Not Checked In)", ...
  String duration; // only set on a logoff
  String time;
};
const int MAX_LOGS = 10;
ScanLog scanLogs[MAX_LOGS];
int logCount = 0;
int logHead = 0;

// Running totals surfaced on the console so the unit can be sanity-checked at
// a glance without reading the whole table.
unsigned long totalTaps = 0;
unsigned long grantedTaps = 0;
unsigned long deniedTaps = 0;

void addScanLog(const String& uid, const String& employee, const String& empId,
                const String& action, const String& status, const String& duration) {
  scanLogs[logHead].uid = uid;
  scanLogs[logHead].employee = employee;
  scanLogs[logHead].empId = empId;
  scanLogs[logHead].action = action;
  scanLogs[logHead].status = status;
  scanLogs[logHead].duration = duration;
  scanLogs[logHead].time = getTimeString();

  logHead = (logHead + 1) % MAX_LOGS;
  if (logCount < MAX_LOGS) {
    logCount++;
  }
}

String readUID() {
  String uidStr = "";
  if (!rfid) return uidStr;
  for (byte i = 0; i < rfid->uid.size; i++) {
    if (rfid->uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(rfid->uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();
  return uidStr;
}

String backendUrl(const char* path) {
  return "https://" + String(SERVER_HOST) + String(API_PREFIX) + path;
}

// The ESP32 doesn't ship trusted root CAs by default, so we skip cert
// validation (setInsecure) rather than embed/maintain Let's Encrypt's chain
// on-device. Traffic is still encrypted end-to-end; this only means the
// device won't detect a MITM presenting a fake certificate.
int postJson(const String& url, const String& jsonBody, String& responseBody) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(jsonBody);
  responseBody = http.getString();
  http.end();
  return code;
}

// Announce this unit to the backend so it appears in the dashboard's Device
// Admin tab alongside the entrance reader. `rack` lets the dashboard label
// this device with the rack it actually guards.
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  String ipStr = WiFi.localIP().toString();
  String body = "{\"deviceName\":\"" + String(DEVICE_NAME) +
                "\",\"deviceType\":\"rack\",\"room\":\"" + String(ROOM_NAME) +
                "\",\"rack\":\"" + String(RACK_NAME) +
                "\",\"ip\":\"" + ipStr + "\"}";
  String response;
  int code = postJson(backendUrl("/rfid/heartbeat"), body, response);
  if (code == 200) {
    Serial.println("Heartbeat OK -> IP: " + ipStr);
  } else {
    Serial.println("Heartbeat failed (HTTP " + String(code) + "): " + response);
  }
}

bool tryRFID(int ssPin, int rstPin, int sckPin, int misoPin, int mosiPin) {
  Serial.printf("Trying RFID config: SS=%d, RST=%d, SCK=%d, MISO=%d, MOSI=%d\n", ssPin, rstPin, sckPin, misoPin, mosiPin);
  if (rfid != nullptr) {
    delete rfid;
    rfid = nullptr;
  }
  SPI.end();
  SPI.begin(sckPin, misoPin, mosiPin, ssPin);
  rfid = new MFRC522(ssPin, rstPin);
  rfid->PCD_Init();

  byte version = rfid->PCD_ReadRegister((MFRC522::PCD_Register)0x37); // VersionReg
  Serial.printf("MFRC522 Version Register: 0x%02X\n", version);

  // 0x00 and 0xFF mean "nothing responded on the bus" (line stuck low/high).
  // Anything else is a real chip answering - clone RC522 modules report
  // version bytes outside the official 0x88/0x90/0x91/0x92 set, and rejecting
  // those made a perfectly working reader show up as "not detected".
  if (version != 0x00 && version != 0xFF) {
    Serial.println("RFID Reader detected successfully!");
    detectedSS = ssPin;
    detectedRST = rstPin;
    return true;
  }
  return false;
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<meta http-equiv='refresh' content='5'>";
  html += "<title>Rack Unit - Device Admin</title>";
  html += "<style>";
  html += "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 20px; }";
  html += ".container { max-width: 800px; margin: 0 auto; }";
  html += "h1 { color: #f97316; font-size: 24px; margin-bottom: 5px; }";
  html += "p.subtitle { color: #9ca3af; margin-top: 0; margin-bottom: 25px; }";
  html += ".grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 25px; }";
  html += ".card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }";
  html += ".card h3 { margin-top: 0; color: #e5e7eb; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; }";
  html += ".stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }";
  html += ".stat-label { color: #9ca3af; }";
  html += ".stat-value { font-weight: 500; color: #f3f4f6; }";
  html += ".status-online { color: #10b981; font-weight: bold; }";
  html += "table { width: 100%; border-collapse: collapse; margin-top: 10px; }";
  html += "th, td { padding: 10px; text-align: left; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); }";
  html += "th { color: #9ca3af; font-weight: 500; }";
  html += ".ok { color: #10b981; } .bad { color: #f87171; }";
  html += "</style>";
  html += "</head><body>";
  html += "<div class='container'>";
  html += "<h1>Rack Unit Admin Portal</h1>";
  html += "<p class='subtitle'>Hardware &amp; System Diagnostics &mdash; " + String(ROOM_NAME) + " / " + String(RACK_NAME) + "</p>";

  html += "<div class='grid'>";

  // Card 1: Network Status
  html += "<div class='card'>";
  html += "<h3>Network Status</h3>";
  html += "<div class='stat-row'><span class='stat-label'>SSID</span><span class='stat-value'>" + String(WIFI_SSID) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>IP Address</span><span class='stat-value'>" + WiFi.localIP().toString() + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>RSSI (Signal)</span><span class='stat-value'>" + String(WiFi.RSSI()) + " dBm</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Status</span><span class='status-online'>Connected</span></div>";
  html += "</div>";

  // Card 2: System Configuration
  html += "<div class='card'>";
  html += "<h3>Configuration</h3>";
  html += "<div class='stat-row'><span class='stat-label'>Device Name</span><span class='stat-value'>" + String(DEVICE_NAME) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Backend Server</span><span class='stat-value'>" + String(SERVER_HOST) + " (HTTPS)</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Room Name</span><span class='stat-value'>" + String(ROOM_NAME) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Rack Name</span><span class='stat-value'>" + String(RACK_NAME) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>RFID SS Pin</span><span class='stat-value'>" + (detectedSS == -1 ? String("Checking...") : String(detectedSS)) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>RFID RST Pin</span><span class='stat-value'>" + (detectedRST == -1 ? String("Checking...") : String(detectedRST)) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Uptime</span><span class='stat-value'>" + String(millis() / 1000 / 60) + " mins</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Free Heap</span><span class='stat-value'>" + String(ESP.getFreeHeap() / 1024) + " KB</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Taps (ok / denied)</span><span class='stat-value'>" + String(grantedTaps) + " / " + String(deniedTaps) + "</span></div>";
  html += "</div>";

  html += "</div>"; // End grid

  // Card 3: Recent Taps
  html += "<div class='card' style='margin-bottom: 25px;'>";
  html += "<h3>Recent Rack Login / Logoff Activity</h3>";
  html += "<table>";
  html += "<thead><tr><th>#</th><th>RFID UID</th><th>Employee</th><th>Emp ID</th><th>Action</th><th>Time</th><th>Duration</th><th>Status</th></tr></thead>";
  html += "<tbody>";
  if (logCount == 0) {
    html += "<tr><td colspan='8' style='text-align: center; color: #9ca3af;'>No scan activity recorded yet.</td></tr>";
  } else {
    for (int i = 0; i < logCount; i++) {
      int idx = (logHead - 1 - i + MAX_LOGS) % MAX_LOGS;
      bool granted = scanLogs[idx].status.startsWith("Granted");
      html += "<tr>";
      html += "<td>" + String(i + 1) + "</td>";
      html += "<td><code>" + scanLogs[idx].uid + "</code></td>";
      html += "<td>" + scanLogs[idx].employee + "</td>";
      html += "<td>" + scanLogs[idx].empId + "</td>";
      html += "<td>" + scanLogs[idx].action + "</td>";
      html += "<td><code>" + scanLogs[idx].time + "</code></td>";
      html += "<td>" + (scanLogs[idx].duration.length() ? scanLogs[idx].duration : String("&mdash;")) + "</td>";
      html += "<td class='" + String(granted ? "ok" : "bad") + "'>" + scanLogs[idx].status + "</td>";
      html += "</tr>";
    }
  }
  html += "</tbody>";
  html += "</table>";
  html += "</div>";

  html += "</div>"; // End container
  html += "</body></html>";

  server.send(200, "text/html", html);
}

// Same data as the console table, for the dashboard or any other client that
// wants this unit's local history without scraping HTML.
void handleStatusJson() {
  JsonDocument doc;
  doc["device"] = DEVICE_NAME;
  doc["room"] = ROOM_NAME;
  doc["rack"] = RACK_NAME;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["uptimeSec"] = millis() / 1000;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["totalTaps"] = totalTaps;
  doc["granted"] = grantedTaps;
  doc["denied"] = deniedTaps;

  JsonArray arr = doc["scans"].to<JsonArray>();
  for (int i = 0; i < logCount; i++) {
    int idx = (logHead - 1 - i + MAX_LOGS) % MAX_LOGS;
    JsonObject o = arr.add<JsonObject>();
    o["uid"] = scanLogs[idx].uid;
    o["employee"] = scanLogs[idx].employee;
    o["empId"] = scanLogs[idx].empId;
    o["action"] = scanLogs[idx].action;
    o["status"] = scanLogs[idx].status;
    o["duration"] = scanLogs[idx].duration;
    o["time"] = scanLogs[idx].time;
  }

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleTap(const String& uid) {
  totalTaps++;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot report rack access.");
    deniedTaps++;
    addScanLog(uid, "-", "-", "Scan", "Denied (No WiFi)", "");
    return;
  }

  String body = "{\"rfidTag\":\"" + uid + "\",\"rack\":\"" + String(RACK_NAME) +
                "\",\"room\":\"" + String(ROOM_NAME) + "\"}";
  String response;
  int code = postJson(backendUrl("/rfid/rack-scan"), body, response);

  // Pull the employee + session details the backend resolved for this tag, so
  // the console shows a name rather than a bare UID.
  String empName = "Unknown";
  String empId = "-";
  String action = "";
  String duration = "";
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, response);
  if (!err) {
    if (!doc["employee"].isNull()) {
      if (!doc["employee"]["name"].isNull()) empName = doc["employee"]["name"].as<String>();
      if (!doc["employee"]["emp_id"].isNull()) empId = doc["employee"]["emp_id"].as<String>();
    }
    if (!doc["action"].isNull()) action = doc["action"].as<String>();
    if (!doc["duration"].isNull()) duration = doc["duration"].as<String>();
  }

  if (code == 201 || code == 200) {
    // 201 = a new rack session was opened, 200 = the open one was closed.
    bool isLogin = (action == "rack-login") || (action == "" && code == 201);
    grantedTaps++;
    addScanLog(uid, empName, empId, isLogin ? "Rack Login" : "Rack Logoff", "Granted", duration);
    if (isLogin) {
      Serial.println("RACK LOGIN  -> " + empName + " (" + empId + ") at " + String(RACK_NAME));
    } else {
      Serial.println("RACK LOGOFF -> " + empName + " (" + empId + ") after " + duration + " at " + String(RACK_NAME));
    }
    Serial.println("Recorded: " + response);
    return;
  }

  deniedTaps++;

  if (code == 403) {
    Serial.println("Denied: " + uid + " is not currently checked in. " + response);
    Serial.println("ACCESS DENIED for " + empName + " (Not Checked In)");
    addScanLog(uid, empName, empId, "Scan", "Denied (Not Checked In)", "");
    return;
  }

  if (code == 404) {
    Serial.println("Unregistered card: " + uid);
    Serial.println("ACCESS DENIED (Unregistered Card)");
    addScanLog(uid, "Unregistered", "-", "Scan", "Denied (Unregistered)", "");
    return;
  }

  Serial.println("Error contacting backend. HTTP code: " + String(code) + " " + response);
  addScanLog(uid, empName, empId, "Scan", "Error (" + String(code) + ")", "");
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi \"");
  Serial.print(WIFI_SSID);
  Serial.println("\"");

  // Retry instead of blocking forever: a rack reader is usually mounted out of
  // reach, so it has to recover from a router reboot without being power-cycled.
  unsigned long wifiStart = millis();
  const unsigned long WIFI_TIMEOUT_MS = 20000;
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
    if (millis() - wifiStart > WIFI_TIMEOUT_MS) {
      Serial.println();
      Serial.print("WiFi connect failed, status code: ");
      Serial.println(WiFi.status());
      Serial.println("Retrying...");
      WiFi.disconnect(true);
      delay(500);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      wifiStart = millis();
    }
  }
  Serial.println();
  Serial.print("Rack Unit IP: ");
  Serial.println(WiFi.localIP());
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==== Rack Unit Booting ====");

  bool rfidDetected = false;
  // Try config 1: standard wiring (RC522 SS=5, RST=22)
  if (tryRFID(5, 22, 18, 19, 23)) {
    rfidDetected = true;
  }

  if (!rfidDetected) {
    Serial.println("WARNING: RFID reader not detected! Checking physical wiring. Defaulting to pins 5/22.");
    tryRFID(5, 22, 18, 19, 23);
  }

  connectWiFi();
  Serial.print("Reporting to backend at ");
  Serial.println(backendUrl(""));

  // Sync wall-clock time so scan-log entries show a real time of day
  // (IST, UTC+5:30) instead of seconds-since-boot.
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  Serial.print("Syncing time via NTP");
  struct tm timeinfo;
  int ntpAttempts = 0;
  while (!getLocalTime(&timeinfo, 500) && ntpAttempts < 10) {
    Serial.print(".");
    ntpAttempts++;
  }
  Serial.println(getLocalTime(&timeinfo, 100) ? " done." : " failed (using uptime fallback).");

  // Web routes
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatusJson);
  server.onNotFound([]() {
    server.send(404, "text/plain", "Not Found");
  });
  server.begin();
  Serial.println("Web server started.");

  // Register device IP with backend so it appears in Device Admin immediately
  // rather than only after the first 30s heartbeat interval elapses.
  sendHeartbeat();
  lastHeartbeat = millis();

  Serial.println("Rack Unit ready. Waiting for RFID taps...");
}

void loop() {
  server.handleClient();

  // Reconnect if the AP dropped, otherwise heartbeats and taps silently fail
  // until someone physically resets the unit. Bounded (unlike the blocking
  // retry used at boot) and still pumping the web server, so the admin console
  // stays reachable while the WiFi is flapping.
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting...");
    WiFi.disconnect(true);
    delay(100);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long retryStart = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - retryStart < 15000) {
      delay(300);
      Serial.print(".");
      server.handleClient();
    }
    Serial.println();
  }

  // Periodic heartbeat
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }

  if (!rfid || !rfid->PICC_IsNewCardPresent() || !rfid->PICC_ReadCardSerial()) {
    return;
  }

  String uid = readUID();
  Serial.println("Tap detected -> UID: " + uid);
  handleTap(uid);

  rfid->PICC_HaltA();
  rfid->PCD_StopCrypto1();
  delay(1000); // simple debounce so one tap isn't read twice
}
