/*
  Broaching Machine Sensor Sketch v3.3
  ====================================
  Fix in v3.3:
  - Fixed ACS712 current reading (was stuck at 0.07A)
  - Correct sensitivity constants for all ACS712 variants
  - Fixed voltage formula (raw → mV → Amps)
  - Uses mean-absolute-deviation for DC current (better than RMS for DC loads)
  - Added serial debug: prints raw ADC and computed current so you can verify
  - Noise floor lowered to 0.01A

  ACS712 SENSITIVITY — pick the right one for YOUR module:
    ACS712-5A  → 185.0 mV/A   (measures 0-5A,  most common for small motors)
    ACS712-20A → 100.0 mV/A   (measures 0-20A, default in this sketch)
    ACS712-30A →  66.0 mV/A   (measures 0-30A)

  Wiring (unchanged):
    DHT11   DATA → pin 2
    MPU6050 SDA  → A4, SCL → A5, VCC → 3.3V
    ACS712  OUT  → A0, VCC → 5V, GND → GND
    Voltage div  → A1  (10k + 10k divider)
*/

#include <avr/wdt.h>
#include <DHT.h>
#include <Wire.h>
#include <MPU6050.h>

#define DHT_PIN         2
#define DHT_TYPE        DHT11
#define ACS_PIN         A0
#define VOLT_PIN        A1

// ── IMPORTANT: Change this to match YOUR ACS712 module ──────
// 5A  module → 185.0
// 20A module → 100.0
// 30A module →  66.0
#define ACS_SENSITIVITY  185.0   // mV per Amp — change if needed!

#define VOLT_DIVIDER    2.0      // 1.0 = direct (max 5V), 2.0 = 1:1 divider (max 10V)
#define VIB_SAMPLES     64
#define CURR_SAMPLES    300      // more samples = more stable reading
#define VOLT_SAMPLES    50
#define SEND_INTERVAL   1000
#define NOISE_FLOOR     0.01     // currents below this treated as 0

DHT     dht(DHT_PIN, DHT_TYPE);
MPU6050 mpu;

float vib_baseline_x = 0, vib_baseline_y = 0, vib_baseline_z = 0;
float lastGoodTemp       = 25.0;
float calibrated_midpoint = 512.0;
unsigned long lastSendTime = 0;

// ── Calibrate ACS712 zero-current midpoint ───────────────────
// Run with NO current flowing through sensor
void calibrateCurrentMidpoint() {
  long sum = 0;
  for (int i = 0; i < 1000; i++) {
    sum += analogRead(ACS_PIN);
    delayMicroseconds(100);
    if (i % 200 == 0) wdt_reset();
  }
  calibrated_midpoint = sum / 1000.0;
  Serial.print("ACS712 midpoint ADC: ");
  Serial.println(calibrated_midpoint);

  // Quick sanity check — should be close to 512 (2.5V at 5V supply)
  float midV = calibrated_midpoint * (5000.0 / 1023.0);
  Serial.print("ACS712 midpoint mV:  ");
  Serial.println(midV);
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
  return max(vib_g_rms * 9.806f, 0.01f);
}

float readCurrent() {
  // ACS712 outputs 2.5V at 0A, shifts by (sensitivity mV) per Amp
  // Formula: current = (Vout - Vmid) / sensitivity
  // where Vout = ADC * (5000mV / 1023)

  float sum_abs = 0;

  for (int i = 0; i < CURR_SAMPLES; i++) {
    int raw = analogRead(ACS_PIN);

    // Convert ADC to millivolts
    float mV = raw * (5000.0f / 1023.0f);

    // Midpoint in millivolts
    float midmV = calibrated_midpoint * (5000.0f / 1023.0f);

    // Current in Amps
    float amps = (mV - midmV) / ACS_SENSITIVITY;

    sum_abs += fabs(amps);
    delayMicroseconds(100);
  }

  float current = sum_abs / CURR_SAMPLES;

  // Debug every reading — open Serial Monitor to verify
  // Comment these out after confirming values look correct
  Serial.print("[DBG] raw ADC sample: ");
  Serial.print(analogRead(ACS_PIN));
  Serial.print("  midpoint: ");
  Serial.print(calibrated_midpoint);
  Serial.print("  current: ");
  Serial.println(current, 4);

  return (current < NOISE_FLOOR) ? 0.0f : current;
}

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

  Serial.println("Calibrating current sensor — keep NO current flowing...");
  calibrateCurrentMidpoint();
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

  float temp    = readTemperatureSafe();   wdt_reset();
  float vib     = readVibration();         wdt_reset();
  float current = readCurrent();           wdt_reset();
  float voltage = readVoltage();           wdt_reset();

  Serial.print("TEMP:");  Serial.print(temp, 2);
  Serial.print(",VIB:");  Serial.print(vib, 3);
  Serial.print(",CURR:"); Serial.print(current, 3);
  Serial.print(",VOLT:"); Serial.println(voltage, 2);
}
