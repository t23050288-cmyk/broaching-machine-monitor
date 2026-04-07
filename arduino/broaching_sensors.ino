/*
  Broaching Machine Sensor Sketch v3.4
  ====================================
  Fixes in v3.4:
  - ACS712 current no longer freezes or repeats same value
  - Midpoint is recalibrated every 30 readings (handles ADC drift)
  - Removed debug Serial.print from inside read loop (was slowing ADC)
  - Reduced sample count but added quality check to detect stuck values
  - Watchdog timer still active as safety net

  ACS712 SENSITIVITY:
    5A  module → 185.0 mV/A
    20A module → 100.0 mV/A
    30A module →  66.0 mV/A

  Wiring:
    DHT11   DATA → pin 2
    MPU6050 SDA  → A4, SCL → A5, VCC → 3.3V
    ACS712  OUT  → A0, VCC → 5V, GND → GND
    Voltage div  → A1  (10k + 10k divider)
*/

#include <avr/wdt.h>
#include <DHT.h>
#include <Wire.h>
#include <MPU6050.h>

#define DHT_PIN          2
#define DHT_TYPE         DHT11
#define ACS_PIN          A0
#define VOLT_PIN         A1

#define ACS_SENSITIVITY  185.0   // mV/A — change to 100.0 for 20A, 66.0 for 30A
#define VOLT_DIVIDER     2.0
#define VIB_SAMPLES      64
#define CURR_SAMPLES     200
#define VOLT_SAMPLES     30
#define SEND_INTERVAL    1000
#define RECAL_INTERVAL   30      // recalibrate current midpoint every N readings

DHT     dht(DHT_PIN, DHT_TYPE);
MPU6050 mpu;

float vib_baseline_x = 0, vib_baseline_y = 0, vib_baseline_z = 0;
float lastGoodTemp        = 25.0;
float lastGoodCurrent     = 0.0;
float calibrated_midpoint = 512.0;

unsigned long lastSendTime  = 0;
int           readingCount  = 0;

// ── Calibrate ACS712 zero-current midpoint ───────────────────
void calibrateCurrentMidpoint() {
  long sum = 0;
  const int CAL_SAMPLES = 500;
  for (int i = 0; i < CAL_SAMPLES; i++) {
    sum += analogRead(ACS_PIN);
    delayMicroseconds(200);
    if (i % 100 == 0) wdt_reset();
  }
  float newMid = sum / (float)CAL_SAMPLES;

  // Sanity check — midpoint should be 400–624 (roughly 2.0–3.0V on 5V ADC)
  if (newMid > 400 && newMid < 624) {
    calibrated_midpoint = newMid;
  }
  // If out of range, keep previous value
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

// ── Temperature with retry ────────────────────────────────────
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

// ── Vibration RMS ─────────────────────────────────────────────
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
  return max(vib_g_rms * 9.806f, 0.01f);
}

// ── Current — fixed version ───────────────────────────────────
float readCurrent() {
  float minVal = 9999, maxVal = -9999;
  float sum = 0;

  // Take CURR_SAMPLES readings as fast as possible (no delay inside)
  // Fast sampling = better representation of AC component
  for (int i = 0; i < CURR_SAMPLES; i++) {
    int raw = analogRead(ACS_PIN);
    float mV    = raw * (5000.0f / 1023.0f);
    float midmV = calibrated_midpoint * (5000.0f / 1023.0f);
    float amps  = (mV - midmV) / ACS_SENSITIVITY;
    sum += fabs(amps);
    if (amps < minVal) minVal = amps;
    if (amps > maxVal) maxVal = amps;
  }

  float avg = sum / CURR_SAMPLES;

  // ── Stuck value detector ──────────────────────────────────
  // If min and max are too close, the ADC is stuck — recalibrate
  float spread = maxVal - minVal;
  if (spread < 0.001f) {
    // ADC frozen — force recalibration and return last good value
    calibrateCurrentMidpoint();
    return lastGoodCurrent;
  }

  // Apply noise floor
  float result = (avg < 0.01f) ? 0.0f : avg;
  lastGoodCurrent = result;
  return result;
}

// ── Voltage ───────────────────────────────────────────────────
float readVoltage() {
  long sum = 0;
  for (int i = 0; i < VOLT_SAMPLES; i++) {
    sum += analogRead(VOLT_PIN);
    delayMicroseconds(100);
  }
  float avg     = sum / (float)VOLT_SAMPLES;
  float voltage = (avg / 1023.0f) * 5.0f * VOLT_DIVIDER;
  return round(voltage * 100.0f) / 100.0f;
}

// ── Setup ─────────────────────────────────────────────────────
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

  Serial.println("Calibrating current sensor…");
  calibrateCurrentMidpoint();
  wdt_reset();

  calibrateVibration();
  wdt_reset();

  Serial.println("READY");
}

// ── Loop ──────────────────────────────────────────────────────
void loop() {
  wdt_reset();

  unsigned long now = millis();
  if (now - lastSendTime < SEND_INTERVAL) return;
  lastSendTime = now;

  // Recalibrate current midpoint every RECAL_INTERVAL readings
  // This fixes ADC drift that causes stuck values over time
  readingCount++;
  if (readingCount % RECAL_INTERVAL == 0) {
    calibrateCurrentMidpoint();
    wdt_reset();
  }

  float temp    = readTemperatureSafe();   wdt_reset();
  float vib     = readVibration();         wdt_reset();
  float current = readCurrent();           wdt_reset();
  float voltage = readVoltage();           wdt_reset();

  Serial.print("TEMP:");  Serial.print(temp, 2);
  Serial.print(",VIB:");  Serial.print(vib, 3);
  Serial.print(",CURR:"); Serial.print(current, 3);
  Serial.print(",VOLT:"); Serial.println(voltage, 2);
}
