#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "ClosedCube_MAX30205.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define PPG_CHARACTERISTIC_UUID "d4f9b2d0-7d4a-4f8f-9c79-8b3e25f7c801"
#define DEVICE_NAME         "MindPulse_Watch"

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define GSR_PIN 32
#define I2C_SDA 21
#define I2C_SCL 22

const unsigned long SENSOR_INTERVAL_MS = 20;
const unsigned long BLE_NOTIFY_INTERVAL_MS = 500;
const unsigned long PPG_NOTIFY_INTERVAL_MS = 250;
const unsigned long DISPLAY_INTERVAL_MS = 1000;
const unsigned long BPM_TIMEOUT_MS = 5000;
const long FINGER_IR_THRESHOLD = 20000;
const byte PPG_BATCH_SIZE = 8;
const byte MIN_VALID_BPM = 35;
const byte MAX_VALID_BPM = 220;

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
BLECharacteristic* pPpgCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_MPU6050 mpu;
MAX30105 particleSensor;
ClosedCube_MAX30205 max30205;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
byte rateCount = 0;
long lastBeat = 0;
unsigned long lastValidBeatAt = 0;
float beatsPerMinute = 0;
int beatAvg = 0;

float accX = 0;
float accY = 0;
float accZ = 0;
float tempC = 0;
long irValue = 0;
int edaValue = 0;

bool displayReady = false;
bool mpuReady = false;
bool max30102Ready = false;
bool max30205Ready = false;

unsigned long lastSensorAt = 0;
unsigned long lastBleNotifyAt = 0;
unsigned long lastPpgNotifyAt = 0;
unsigned long lastDisplayAt = 0;

uint32_t ppgBuffer[PPG_BATCH_SIZE];
byte ppgBufferCount = 0;

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
  }
};

void drawStatus(const char* line1, const char* line2 = "") {
  if (!displayReady) return;

  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setCursor(0, 0);
  display.println(line1);
  if (strlen(line2) > 0) {
    display.println(line2);
  }
  display.display();
}

void setupSensors() {
  mpuReady = mpu.begin();
  max30205.begin(0x4C);
  max30205Ready = true;

  max30102Ready = particleSensor.begin(Wire, I2C_SPEED_FAST);
  if (max30102Ready) {
    particleSensor.setup(0x3F, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x1F);
    particleSensor.setPulseAmplitudeIR(0x3F);
    particleSensor.setPulseAmplitudeGreen(0);
    Serial.println("MAX30102 ready");
  } else {
    Serial.println("MAX30102 not found");
  }
}

void setupBle() {
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );

  pCharacteristic->addDescriptor(new BLE2902());

  pPpgCharacteristic = pService->createCharacteristic(
    PPG_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pPpgCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
}

void updateHeartRate(long ir) {
  if (!max30102Ready) {
    beatAvg = 0;
    return;
  }

  if (ir < FINGER_IR_THRESHOLD) {
    beatAvg = 0;
    rateSpot = 0;
    rateCount = 0;
    lastBeat = 0;
    return;
  }

  if (checkForBeat(ir)) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    lastValidBeatAt = millis();

    if (delta <= 0) return;

    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute <= MAX_VALID_BPM && beatsPerMinute >= MIN_VALID_BPM) {
      rates[rateSpot++] = (byte)beatsPerMinute;
      rateSpot %= RATE_SIZE;
      if (rateCount < RATE_SIZE) {
        rateCount++;
      }

      beatAvg = 0;
      for (byte x = 0; x < rateCount; x++) {
        beatAvg += rates[x];
      }
      beatAvg /= rateCount;
    }
  }

  if (lastValidBeatAt > 0 && millis() - lastValidBeatAt > BPM_TIMEOUT_MS) {
    beatAvg = 0;
    rateSpot = 0;
    rateCount = 0;
  }
}

void sampleSensors() {
  if (mpuReady) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    accX = a.acceleration.x;
    accY = a.acceleration.y;
    accZ = a.acceleration.z;
  }

  if (max30205Ready) {
    float nextTemp = max30205.readTemperature();
    if (!isnan(nextTemp)) {
      tempC = nextTemp;
    }
  }

  if (max30102Ready) {
    irValue = particleSensor.getIR();
    updateHeartRate(irValue);

    if (ppgBufferCount < PPG_BATCH_SIZE) {
      ppgBuffer[ppgBufferCount++] = (uint32_t)irValue;
    }
  }

  edaValue = analogRead(GSR_PIN);
}

String buildPayload() {
  return String(accX, 3) + "," +
         String(accY, 3) + "," +
         String(accZ, 3) + "," +
         String(tempC, 2) + "," +
         String(beatAvg) + "," +
         String(irValue) + "," +
         String(edaValue);
}

void notifyBle() {
  if (!deviceConnected || pCharacteristic == NULL) return;

  String payload = buildPayload();
  pCharacteristic->setValue(payload.c_str());
  pCharacteristic->notify();
  Serial.println(payload);
}

void notifyPpgBle() {
  if (!deviceConnected || pPpgCharacteristic == NULL || ppgBufferCount == 0) return;

  byte payload[1 + (PPG_BATCH_SIZE * 4)];
  payload[0] = ppgBufferCount;

  for (byte i = 0; i < ppgBufferCount; i++) {
    uint32_t sample = ppgBuffer[i];
    byte offset = 1 + (i * 4);
    payload[offset] = sample & 0xFF;
    payload[offset + 1] = (sample >> 8) & 0xFF;
    payload[offset + 2] = (sample >> 16) & 0xFF;
    payload[offset + 3] = (sample >> 24) & 0xFF;
  }

  pPpgCharacteristic->setValue(payload, 1 + (ppgBufferCount * 4));
  pPpgCharacteristic->notify();
  ppgBufferCount = 0;
}

void updateDisplay() {
  if (!displayReady) return;

  display.clearDisplay();
  display.setCursor(0, 0);
  display.println(deviceConnected ? "APP CONNECTED" : "BLE Ready");
  display.print("BPM: ");
  display.println(beatAvg);
  display.print("IR: ");
  display.println(irValue);
  display.print("Temp: ");
  display.println(tempC);
  display.display();
}

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);
  pinMode(GSR_PIN, INPUT);

  displayReady = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  drawStatus("Starting BLE...");

  setupSensors();
  setupBle();

  drawStatus("BLE Ready!", "Waiting for App...");
  Serial.println("MindPulse ESP32 ready");
}

void loop() {
  unsigned long now = millis();

  if (now - lastSensorAt >= SENSOR_INTERVAL_MS) {
    lastSensorAt = now;
    sampleSensors();
  }

  if (deviceConnected && now - lastBleNotifyAt >= BLE_NOTIFY_INTERVAL_MS) {
    lastBleNotifyAt = now;
    notifyBle();
  }

  if (deviceConnected && now - lastPpgNotifyAt >= PPG_NOTIFY_INTERVAL_MS) {
    lastPpgNotifyAt = now;
    notifyPpgBle();
  }

  if (now - lastDisplayAt >= DISPLAY_INTERVAL_MS) {
    lastDisplayAt = now;
    updateDisplay();
  }

  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
    drawStatus("BLE Ready!", "Waiting for App...");
  }

  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
}
