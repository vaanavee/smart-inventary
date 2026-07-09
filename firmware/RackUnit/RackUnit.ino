/*
  Rack Unit - ESP32 + MFRC522
  ---------------------------------
  Sits at a specific rack. When an employee taps their card here, this unit
  reports the tap directly to the real Node backend:

    POST /api/rfid/rack-scan { rfidTag, rack, room }

  The backend rejects the tap (403) if that employee doesn't currently have
  an open entrance session - they must tap the EntranceUnit's reader first.
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

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
const char* RACK_NAME    = "A";

// ---------------- RFID (Dynamic Pins) ----------------
MFRC522* rfid = nullptr;
int detectedSS = -1;
int detectedRST = -1;

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

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==== Rack Unit Booting ====");

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
  if (!rfid || !rfid->PICC_IsNewCardPresent() || !rfid->PICC_ReadCardSerial()) {
    return;
  }

  String uid = readUID();
  Serial.println("Tap detected -> UID: " + uid);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot report rack access.");
  } else {
    String body = "{\"rfidTag\":\"" + uid + "\",\"rack\":\"" + String(RACK_NAME) +
                  "\",\"room\":\"" + String(ROOM_NAME) + "\"}";

    // setInsecure(): skip cert validation rather than embed/maintain a root CA
    // bundle on-device. Traffic is still encrypted; only MITM detection is skipped.
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    http.begin(client, backendUrl("/rfid/rack-scan"));
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

  rfid->PICC_HaltA();
  rfid->PCD_StopCrypto1();
  delay(1000); // simple debounce so one tap isn't read twice
}
