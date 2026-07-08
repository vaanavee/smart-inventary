/*
  Rack Unit - ESP32 + MFRC522
  ---------------------------------
  Sits at a specific rack. When an employee taps their card here, this unit
  reports the tap directly to the real Node backend:

    POST /api/rfid/rack-scan { rfidTag, rack, room }

  The backend rejects the tap (403) if that employee doesn't currently have
  an open entrance session - they must tap the EntranceUnit's reader first.
  This unit and the EntranceUnit are two independent ESP32 boards that both
  join the same real WiFi network and both talk to the same backend -
  neither one talks to the other directly anymore.

  BEFORE FLASHING - fill in the placeholders below:
    WIFI_SSID / WIFI_PASSWORD : same real WiFi network as the EntranceUnit
    SERVER_HOST                : LAN IP of the machine running the Node
                                  backend (NOT 127.0.0.1 - find it with
                                  `ipconfig` on that machine)
    ROOM_NAME / RACK_NAME      : must match a room/rack already known to
                                  the backend (e.g. "Room 1" / "A")

  Wiring (MFRC522 -> ESP32) - same as Entrance Unit, adjust pins if needed:
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
const char* SERVER_HOST = "192.168.29.106";
const int   SERVER_PORT = 4000;
const char* ROOM_NAME   = "Room 1";
const char* RACK_NAME   = "A";

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
  Serial.print("Rack Unit IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Reporting to backend at ");
  Serial.println(backendUrl(""));

  Serial.println("Rack Unit ready. Waiting for RFID taps...");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = readUID();
  Serial.println("Tap detected -> UID: " + uid);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot report rack access.");
  } else {
    String body = "{\"rfidTag\":\"" + uid + "\",\"rack\":\"" + String(RACK_NAME) +
                  "\",\"room\":\"" + String(ROOM_NAME) + "\"}";

    HTTPClient http;
    http.begin(backendUrl("/api/rfid/rack-scan"));
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(body);
    String response = http.getString();
    http.end();

    if (code == 201) {
      Serial.println("Recorded: " + response);
    } else if (code == 403) {
      Serial.println("Denied: " + uid + " is not currently checked in. " + response);
    } else if (code == 404) {
      Serial.println("Unregistered card: " + uid);
    } else {
      Serial.println("Error contacting backend. HTTP code: " + String(code) + " " + response);
    }
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(1000); // simple debounce so one tap isn't read twice
}
