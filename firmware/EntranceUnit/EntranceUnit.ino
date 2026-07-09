/*
  Entrance Unit - ESP32 + MFRC522
  ---------------------------------
  Handles employee LOGIN / LOGOUT via RFID tap at the entrance.

  Talks directly to the real Smart Inventory Node backend over your normal
  WiFi network. Exposes a local administration web console on port 80.
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <time.h>

// ---------------- WiFi ----------------
const char* WIFI_SSID     = "Wisright";
const char* WIFI_PASSWORD = "26488668";

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

// ---------------- Web Server & Devices ----------------
WebServer server(80);

// ---------------- RFID (Dynamic Pins) ----------------
MFRC522* rfid = nullptr;
int detectedSS = -1;
int detectedRST = -1;

// Heartbeat tracking
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Recent Scans Ring Buffer
struct ScanLog {
  String uid;
  String action;
  String status;
  String time;
};
const int MAX_LOGS = 10;
ScanLog scanLogs[MAX_LOGS];
int logCount = 0;
int logHead = 0;

// NTP-synced wall-clock time (IST, UTC+5:30) so tap in/out entries show a real
// time of day instead of "seconds since boot". Falls back to uptime if NTP
// hasn't synced yet (e.g. right after boot, before the first sync completes).
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

void addScanLog(const String& uid, const String& action, const String& status) {
  scanLogs[logHead].uid = uid;
  scanLogs[logHead].action = action;
  scanLogs[logHead].status = status;
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

int postJson(const String& url, const String& jsonBody, String& responseBody) {
  // The ESP32 doesn't ship trusted root CAs by default, so we skip cert
  // validation (setInsecure) rather than embed/maintain Let's Encrypt's
  // chain on-device. Traffic is still encrypted end-to-end; this only
  // means the device won't detect a MITM presenting a fake certificate.
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

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  String ipStr = WiFi.localIP().toString();
  String body = "{\"deviceName\":\"Entrance Unit\",\"room\":\"" + String(ROOM_NAME) + "\",\"ip\":\"" + ipStr + "\"}";
  String response;
  int code = postJson(backendUrl("/rfid/heartbeat"), body, response);
  if (code == 200) {
    Serial.println("Heartbeat OK -> IP: " + ipStr);
  } else {
    Serial.println("Heartbeat failed (HTTP " + String(code) + "): " + response);
  }
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Entrance Unit - Device Admin</title>";
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
  html += "</style>";
  html += "</head><body>";
  html += "<div class='container'>";
  html += "<h1>Entrance Unit Admin Portal</h1>";
  html += "<p class='subtitle'>Hardware & System Diagnostics</p>";
  
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
  html += "<div class='stat-row'><span class='stat-label'>Backend Server</span><span class='stat-value'>" + String(SERVER_HOST) + " (HTTPS)</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Room Name</span><span class='stat-value'>" + String(ROOM_NAME) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>RFID SS Pin</span><span class='stat-value'>" + (detectedSS == -1 ? "Checking..." : String(detectedSS)) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>RFID RST Pin</span><span class='stat-value'>" + (detectedRST == -1 ? "Checking..." : String(detectedRST)) + "</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Uptime</span><span class='stat-value'>" + String(millis() / 1000 / 60) + " mins</span></div>";
  html += "<div class='stat-row'><span class='stat-label'>Free Heap</span><span class='stat-value'>" + String(ESP.getFreeHeap() / 1024) + " KB</span></div>";
  html += "</div>";
  
  html += "</div>"; // End grid
  
  // Card 3: Recent Taps
  html += "<div class='card' style='margin-bottom: 25px;'>";
  html += "<h3>Recent RFID Scan Activity</h3>";
  html += "<table>";
  html += "<thead><tr><th>#</th><th>RFID UID</th><th>Action</th><th>Time</th><th>Status / Response</th></tr></thead>";
  html += "<tbody>";
  if (logCount == 0) {
    html += "<tr><td colspan='5' style='text-align: center; color: #9ca3af;'>No scan activity recorded yet.</td></tr>";
  } else {
    for (int i = 0; i < logCount; i++) {
      int idx = (logHead - 1 - i + MAX_LOGS) % MAX_LOGS;
      html += "<tr>";
      html += "<td>" + String(i + 1) + "</td>";
      html += "<td><code>" + scanLogs[idx].uid + "</code></td>";
      html += "<td>" + scanLogs[idx].action + "</td>";
      html += "<td><code>" + scanLogs[idx].time + "</code></td>";
      html += "<td>" + scanLogs[idx].status + "</td>";
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
  
  if (version == 0x91 || version == 0x92 || version == 0x88 || version == 0x90) {
    Serial.println("RFID Reader detected successfully!");
    detectedSS = ssPin;
    detectedRST = rstPin;
    return true;
  }
  return false;
}

void handleTap(const String& uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot reach backend.");
    addScanLog(uid, "Scan", "No WiFi");
    return;
  }

  String checkinBody = "{\"rfidTag\":\"" + uid + "\",\"room\":\"" + String(ROOM_NAME) + "\"}";
  String response;
  int code = postJson(backendUrl("/rfid/checkin"), checkinBody, response);

  if (code == 200) {
    Serial.println("LOGIN OK  -> " + response);
    addScanLog(uid, "Check-in", "Success");
    return;
  }

  if (code == 409) {
    String checkoutBody = "{\"rfidTag\":\"" + uid + "\"}";
    code = postJson(backendUrl("/rfid/checkout"), checkoutBody, response);
    if (code == 200) {
      Serial.println("LOGOUT OK -> " + response);
      addScanLog(uid, "Check-out", "Success");
    } else {
      Serial.println("Logout failed (HTTP " + String(code) + "): " + response);
      addScanLog(uid, "Check-out", "Failed (" + String(code) + ")");
    }
    return;
  }

  if (code == 404) {
    Serial.println("Unregistered card: " + uid);
    addScanLog(uid, "Scan", "Unregistered (404)");
    return;
  }

  Serial.println("Backend error (HTTP " + String(code) + "): " + response);
  addScanLog(uid, "Scan", "Error (" + String(code) + ")");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==== Entrance Unit Booting ====");

  bool rfidDetected = false;
  // Try config 1: standard wiring
  if (tryRFID(5, 22, 18, 19, 23)) {
    rfidDetected = true;
  }
  // Try config 2: standalone wiring
  else if (tryRFID(15, 21, 18, 19, 23)) {
    rfidDetected = true;
  }

  if (!rfidDetected) {
    Serial.println("WARNING: RFID reader not detected! Checking physical wiring. Defaulting to pins 5/22.");
    tryRFID(5, 22, 18, 19, 23);
  }

  // Connect WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Entrance Unit IP: ");
  Serial.println(WiFi.localIP());
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
  server.onNotFound([]() {
    server.send(404, "text/plain", "Not Found");
  });
  server.begin();
  Serial.println("Web server started.");

  // Register device IP with backend
  sendHeartbeat();
  lastHeartbeat = millis();

  Serial.println("Entrance Unit ready. Waiting for RFID taps...");
}

void loop() {
  server.handleClient();

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
  delay(1000); // Debounce delay
}
