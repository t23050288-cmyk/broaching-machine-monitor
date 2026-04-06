/*
  Broaching Machine Sensor Sketch v3.1
  ====================================
  Fixes in v3.1:
  - ACS712 fixed midpoint calibration at startup (not dynamic per-reading)
    This prevents battery-powered voltage sag from causing current to read 0
    after the initial spike
  - Increased CURR_SAMPLES for better averaging on battery
  - Removed dynamic midpoint — uses stored calibrated_midpoint instead
  - Added low-current noise floor adjustment (0.02A instead of 0.05A)

  Wiring:
    DHT11  DATA pin  -> Arduino pin 2
    MPU6050 SDA      -> Arduino A4
    MPU6050 SCL      -> Arduino A5
    MPU6050 VCC      -> 3.3V (NOT 5V)
    MPU6050 GND      -> GND
    ACS712  OUT      -> Arduino A0
    ACS712  VCC      -> 5V
    ACS712  GND      -> GND

  Libraries needed:
    - DHT sensor library by Adafruit
    - Adafruit Unified Sensor
    - MPU6050 by Electronic Cats

  Output: TEMP:25.30,VIB:2.45,CURR:1.20
*/

#include <avr/wdt.h>
#include <DHT.h>
#include <Wire.h>
#include <MPU6050.h>

#define DHT_PIN          2
#define DHT_TYPE         DHT11
#define ACS_PIN          A0
#define ACS_SENSITIVITY  100.0   // mV/A — change to 66.0 for 30A module, 185.0 for 5A module
#define VIB_SAMPLES      64
#define CURR_SAMPLES     200     // increased for better battery stability
#define SEND_INTERVAL    1000

DHT dht(DHT_PIN, DHT_TYPE);
MPU6050 mpu;

float vib_baseline_x = 0, vib_baseline_y = 0, vib_baseline_z = 0;
float lastGoodTemp    = 25.0;
float calibrated_midpoint = 512.0;  // will be set during setup()
unsigned long lastSendTime = 0;

// ── Calibrate ACS712 midpoint once at startup ─────────────────
// This locks the zero-current reference point. On battery, the 
// supply voltage may sag slightly but the midpoint ratio stays 
// stable if we reference it once at rest (no load).
void calibrateCurrentMidpoint() {
  long sum = 0;
  for (int i = 0; i < 500; i++) {
    sum += analogRead(ACS_PIN);
    delayMicroseconds(200);
    if (i % 100 == 0) wdt_reset();
  }
  calibrated_midpoint = sum / 500.0;
  Serial.print("ACS712 midpoint calibrated: ");
  Serial.println(calibrated_midpoint);
}

void calibrateVibration() {
  long sx = 0, sy = 0, sz = 0;
  for (int i = 0; i < 100; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    sx += ax; sy += ay; sz += az;
    delay(5);
    wdt_reset();
  }
  vib_baseline_x = sx / 100.0;
  vib_baseline_y = sy / 100.0;
  vib_baseline_z = sz / 100.0;
}

float readTemperatureSafe() {
  for (int attempt = 0; attempt < 3; attempt++) {
    float t = dht.readTemperature();
    if (!isnan(t) && t > -10.0 && t < 120.0) {
      lastGoodTemp = t;
      return t;
    }
    delay(50);
    wdt_reset();
  }
  return lastGoodTemp;
}

float readVibration() {
  float sum_sq = 0;
  for (int i = 0; i < VIB_SAMPLES; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    float dx = (ax - vib_baseline_x) / 16384.0;
    float dy = (ay - vib_baseline_y) / 16384.0;
    float dz = (az - vib_baseline_z) / 16384.0;
    sum_sq += dx*dx + dy*dy + dz*dz;
    delayMicroseconds(500);
  }
  float vib_g_rms = sqrt(sum_sq / VIB_SAMPLES);
  float vib = vib_g_rms * 9.806;
  return max(vib, 0.01f);
}

float readCurrent() {
  // Use FIXED calibrated_midpoint — not a dynamic average per reading.
  // Dynamic average was the bug: on battery, the voltage sags slightly,
  // the average shifts to match, and the RMS comes out near zero.
  float curr_sum_sq = 0;
  for (int i = 0; i < CURR_SAMPLES; i++) {
    float raw = analogRead(ACS_PIN);
    float v   = ((raw - calibrated_midpoint) / 1023.0) * 5000.0;  // mV
    float a   = v / ACS_SENSITIVITY;
    curr_sum_sq += a * a;
    delayMicroseconds(200);
  }
  float current = sqrt(curr_sum_sq / CURR_SAMPLES);
  // Lower noise floor: 0.02A (was 0.05A — too aggressive on battery)
  return (current < 0.02) ? 0.0 : current;
}

void setup() {
  wdt_enable(WDTO_8S);
  Serial.begin(9600);
  dht.begin();
  Wire.begin();
  Wire.setClock(100000);
  mpu.initialize();
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);

  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed!");
  }

  wdt_reset();
  delay(2000);
  wdt_reset();

  // Calibrate both sensors before first reading
  calibrateCurrentMidpoint();  // ACS712 zero-current baseline
  wdt_reset();
  calibrateVibration();
  wdt_reset();

  Serial.println("READY");
}

void loop() {
  wdt_reset();

  unsigned long now = millis();
  if (now - lastSendTime < SEND_INTERVAL) return;
  lastSendTime = now;

  float temp    = readTemperatureSafe();
  wdt_reset();
  float vib     = readVibration();
  wdt_reset();
  float current = readCurrent();
  wdt_reset();

  Serial.print("TEMP:");
  Serial.print(temp, 2);
  Serial.print(",VIB:");
  Serial.print(vib, 3);
  Serial.print(",CURR:");
  Serial.println(current, 3);
}
