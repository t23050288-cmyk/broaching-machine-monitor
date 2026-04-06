/*
  Broaching Machine Sensor Sketch v3.2
  ====================================
  Changes in v3.2:
  - Added supply voltage reading via Arduino A1 pin (voltage divider)
  - Output format: TEMP:25.30,VIB:2.45,CURR:1.20,VOLT:4.95
  - Voltage divider: 5V → 10kΩ/10kΩ divider → A1 (reads 0-5V as 0-2.5V on pin)
    Formula: voltage = (analogRead(A1) / 1023.0) * 5.0 * 2.0  (×2 for divider ratio)
    If reading Arduino VCC directly: voltage = (analogRead(A1) / 1023.0) * 5.0

  v3.1 fixes retained:
  - ACS712 fixed midpoint calibration for battery operation
  - Lower noise floor (0.02A)
  - 200 current samples

  Wiring:
    DHT11  DATA pin  -> Arduino pin 2
    MPU6050 SDA      -> Arduino A4
    MPU6050 SCL      -> Arduino A5
    MPU6050 VCC      -> 3.3V
    MPU6050 GND      -> GND
    ACS712  OUT      -> Arduino A0
    ACS712  VCC      -> 5V
    ACS712  GND      -> GND
    Voltage divider  -> Arduino A1
      (10kΩ from supply+ to A1, 10kΩ from A1 to GND)

  Libraries:
    - DHT sensor library by Adafruit
    - Adafruit Unified Sensor
    - MPU6050 by Electronic Cats
*/

#include <avr/wdt.h>
#include <DHT.h>
#include <Wire.h>
#include <MPU6050.h>

#define DHT_PIN          2
#define DHT_TYPE         DHT11
#define ACS_PIN          A0
#define VOLT_PIN         A1    // voltage divider output
#define VOLT_DIVIDER     2.0   // ratio: actual voltage = reading × VOLT_DIVIDER
                               // use 1.0 if measuring directly (max 5V)
                               // use 2.0 if using 1:1 voltage divider (max 10V)
#define ACS_SENSITIVITY  100.0
#define VIB_SAMPLES      64
#define CURR_SAMPLES     200
#define VOLT_SAMPLES     50
#define SEND_INTERVAL    1000

DHT dht(DHT_PIN, DHT_TYPE);
MPU6050 mpu;

float vib_baseline_x = 0, vib_baseline_y = 0, vib_baseline_z = 0;
float lastGoodTemp    = 25.0;
float calibrated_midpoint = 512.0;
unsigned long lastSendTime = 0;

void calibrateCurrentMidpoint() {
  long sum = 0;
  for (int i = 0; i < 500; i++) {
    sum += analogRead(ACS_PIN);
    delayMicroseconds(200);
    if (i % 100 == 0) wdt_reset();
  }
  calibrated_midpoint = sum / 500.0;
  Serial.print("ACS712 midpoint: ");
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
  return max(vib_g_rms * 9.806, 0.01f);
}

float readCurrent() {
  float curr_sum_sq = 0;
  for (int i = 0; i < CURR_SAMPLES; i++) {
    float raw = analogRead(ACS_PIN);
    float v   = ((raw - calibrated_midpoint) / 1023.0) * 5000.0;
    float a   = v / ACS_SENSITIVITY;
    curr_sum_sq += a * a;
    delayMicroseconds(200);
  }
  float current = sqrt(curr_sum_sq / CURR_SAMPLES);
  return (current < 0.02) ? 0.0 : current;
}

float readVoltage() {
  long sum = 0;
  for (int i = 0; i < VOLT_SAMPLES; i++) {
    sum += analogRead(VOLT_PIN);
    delayMicroseconds(100);
  }
  float avg = sum / (float)VOLT_SAMPLES;
  // Convert ADC reading to actual voltage
  float voltage = (avg / 1023.0) * 5.0 * VOLT_DIVIDER;
  return round(voltage * 100) / 100.0;  // round to 2 decimal places
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

  float temp    = readTemperatureSafe();
  wdt_reset();
  float vib     = readVibration();
  wdt_reset();
  float current = readCurrent();
  wdt_reset();
  float voltage = readVoltage();
  wdt_reset();

  Serial.print("TEMP:");
  Serial.print(temp, 2);
  Serial.print(",VIB:");
  Serial.print(vib, 3);
  Serial.print(",CURR:");
  Serial.print(current, 3);
  Serial.print(",VOLT:");
  Serial.println(voltage, 2);
}
