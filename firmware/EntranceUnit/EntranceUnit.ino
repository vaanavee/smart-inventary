/*
  Entrance Unit - ESP32 + MFRC522
  ---------------------------------
  Handles employee LOGIN / LOGOUT via RFID tap at the entrance.

  Talks directly to the real Smart Inventory Node backend over your normal
  WiFi network (no more standalone Access Point) - so entries actually land
  in the same SQLite database the dashboard reads from:

    1st tap of a card  -> POST /api/rfid/checkin  (opens a room_entries row)
    2nd tap (same card) -> POST /api/rfid/checkout (closes that row)

  The ESP32 doesn't track login/logout state itself - it always tries
  checkin first. If the backend replies 409 (employee already has an open
  session), that means this tap must be a logout, so it retries as
  checkout. This keeps the ESP32 stateless: it survives reboots without
  losing track of who's "in".

  BEFORE FLASHING - fill in the three placeholders below:
    WIFI_SSID / WIFI_PASSWORD : your real WiFi network (same one the
                                  computer running the Node backend is on)
    SERVER_HOST                : that computer's LAN IP address (NOT
                                  127.0.0.1/localhost - that means the
                                  ESP32 itself). Find it with `ipconfig`
                                  (Windows) -> IPv4 Address.
    ROOM_NAME                  : must exactly match a room name already
                                  used in the backend (e.g. "Room 1")

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
    - ESP32 board package (provides WiFi.h, HTTPClient.h)
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ---------------- WiFi ----------------
const char* WIFI_SSID     = "Wisright";
const char* WIFI_PASSWORD = "26488668";

// ---------------- Backend ----------------
// LAN IP of the machine running `node index.js` (server/), e.g. "192.168.1.42".
const char* SERVER_HOST = "192.168.1.42";
const int   SERVER_PORT = 4000;
const char* ROOM_NAME   = "Room 1";

// ---------------- RFID ----------------
#define SS_PIN  5
#define RST_PIN 22
MFRC522 rfid(SS_PIN, RST_PIN);

String readUID() {
  String uidStr = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(rfid.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();
  return uidStr;
}

String backendUrl(const char* path) {
  return "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + path;
}

// Returns the HTTP status code, or a negative value on a connection failure.
int postJson(const String& url, const String& jsonBody, String& responseBody) {
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(jsonBody);
  responseBody = http.getString();
  http.end();
  return code;
}

void handleTap(const String& uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot reach backend.");
    return;
  }

  String checkinBody = "{\"rfidTag\":\"" + uid + "\",\"room\":\"" + String(ROOM_NAME) + "\"}";
  String response;
  int code = postJson(backendUrl("/api/rfid/checkin"), checkinBody, response);

  if (code == 200) {
    Serial.println("LOGIN OK  -> " + response);
    return;
  }

  if (code == 409) {
    // Already has an open session - this tap is a logout instead.
    String checkoutBody = "{\"rfidTag\":\"" + uid + "\"}";
    code = postJson(backendUrl("/api/rfid/checkout"), checkoutBody, response);
    if (code == 200) {
      Serial.println("LOGOUT OK -> " + response);
    } else {
      Serial.println("Logout failed (HTTP " + String(code) + "): " + response);
    }
    return;
  }

  if (code == 404) {
    Serial.println("Unregistered card: " + uid);
    return;
  }

  Serial.println("Backend error (HTTP " + String(code) + "): " + response);
}

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();

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

  Serial.println("Entrance Unit ready. Waiting for RFID taps...");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = readUID();
  Serial.println("Tap detected -> UID: " + uid);
  handleTap(uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(1000); // simple debounce so one tap isn't read twice
}
