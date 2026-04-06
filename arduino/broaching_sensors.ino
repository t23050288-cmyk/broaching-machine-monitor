/*
  Broaching Machine Sensor Sketch v3.0
  ====================================
  Fixes:
  - DHT11 timeout guard (was freezing the loop)
  - Non-blocking millis() timing instead of delay()
  - Watchdog timer to auto-reset if Arduino hangs
  - Retry logic for DHT11 read failures

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

#include <avr/wdt.h>      // Watchdog timer
#include <DHT.h>
#include <Wire.h>
#include <MPU6050.h>

#define DHT_PIN          2
#define DHT_TYPE         DHT11
#define ACS_PIN          A0
#define ACS_SENSITIVITY  100.0
#define VIB_SAMPLES      64
#define CURR_SAMPLES     150
#define SEND_INTERVAL    1000  // ms between readings

DHT dht(DHT_PIN, DHT_TYPE);
MPU6050 mpu;

float vib_baseline_x = 0, vib_baseline_y = 0, vib_baseline_z = 0;
float lastGoodTemp = 25.0;   // remember last valid temperature
unsigned long lastSendTime = 0;

void calibrateVibration() {
  long sx = 0, sy = 0, sz = 0;
  for (int i = 0; i < 100; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    sx += ax; sy += ay; sz += az;
    delay(5);
    wdt_reset(); // keep watchdog happy during calibration
  }
  vib_baseline_x = sx / 100.0;
  vib_baseline_y = sy / 100.0;
  vib_baseline_z = sz / 100.0;
}

float readTemperatureSafe() {
  // Try up to 3 times with a short delay
  for (int attempt = 0; attempt < 3; attempt++) {
    float t = dht.readTemperature();
    if (!isnan(t) && t > -10.0 && t < 120.0) {
      lastGoodTemp = t;  // save last valid reading
      return t;
    }
    delay(50); // short wait before retry
    wdt_reset();
  }
  // All attempts failed — return last known good value
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
  long sum = 0;
  int readings[CURR_SAMPLES];
  for (int i = 0; i < CURR_SAMPLES; i++) {
    readings[i] = analogRead(ACS_PIN);
    sum += readings[i];
    delayMicroseconds(200);
  }
  float midpoint = sum / (float)CURR_SAMPLES;
  float curr_sum_sq = 0;
  for (int i = 0; i < CURR_SAMPLES; i++) {
    float v = ((readings[i] - midpoint) / 1023.0) * 5000.0;
    float a = v / ACS_SENSITIVITY;
    curr_sum_sq += a * a;
  }
  float current = sqrt(curr_sum_sq / CURR_SAMPLES);
  return (current < 0.05) ? 0.0 : current;
}

void setup() {
  // Enable watchdog — resets Arduino if it hangs for more than 8 seconds
  wdt_enable(WDTO_8S);

  Serial.begin(9600);
  dht.begin();
  Wire.begin();
  Wire.setClock(100000); // slow I2C to 100kHz — more stable
  mpu.initialize();
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);

  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed!");
  }

  wdt_reset();
  delay(2000);
  wdt_reset();
  calibrateVibration();
  wdt_reset();

  Serial.println("READY");
}

void loop() {
  wdt_reset(); // reset watchdog every loop — if this stops, Arduino reboots

  unsigned long now = millis();
  if (now - lastSendTime < SEND_INTERVAL) return; // non-blocking wait
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
