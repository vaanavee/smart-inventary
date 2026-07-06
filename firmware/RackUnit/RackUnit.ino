/*
  Rack Unit - ESP32 + MFRC522
  ---------------------------------
  Sits at the "Stationery" rack. When an employee taps their card here,
  this unit reports the tap to the Entrance Unit over WiFi so it can be
  logged against that employee's currently active login session.

  If the tapped card has no active session at the Entrance Unit (i.e. the
  employee never logged in, or already logged out), the Entrance Unit
  rejects the report and this unit prints a warning instead.

  NETWORKING (for now): the Entrance Unit hosts its own WiFi network
  (Access Point). This unit joins it directly as a station - no external
  router needed for this bench-test setup.

    SSID     : InventoryESP32
    Password : Inventory123
    Entrance Unit IP: 192.168.4.1

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

// ---------------- WiFi (join the Entrance Unit's Access Point) ----------------
const char* WIFI_SSID     = "InventoryESP32";
const char* WIFI_PASSWORD = "Inventory123";

// Entrance Unit's fixed AP IP (192.168.4.1 by default on ESP32).
const char* ENTRANCE_UNIT_URL = "http://192.168.4.1/rackAccess";

// Only one rack for now.
const char* RACK_NAME = "Stationery";

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

  Serial.println("Rack Unit ready. Waiting for RFID taps...");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = readUID();
  Serial.println("Tap detected -> UID: " + uid);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(ENTRANCE_UNIT_URL) + "?uid=" + uid + "&rack=" + RACK_NAME;
    http.begin(url);
    int httpCode = http.GET();

    if (httpCode == 200) {
      Serial.println("Recorded: " + uid + " took from " + String(RACK_NAME));
    } else if (httpCode == 403) {
      Serial.println("Denied: " + uid + " is not currently logged in at the Entrance.");
    } else {
      Serial.println("Error contacting Entrance Unit. HTTP code: " + String(httpCode));
    }
    http.end();
  } else {
    Serial.println("WiFi not connected, cannot report rack access.");
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(1000); // simple debounce so one tap isn't read twice
}
