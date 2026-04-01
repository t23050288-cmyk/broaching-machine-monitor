/*
  Broaching Machine Sensor Sketch v2
  ====================================
  Reads DHT11 (temperature), MPU6050 (vibration), ACS712 (current)
  Uses RMS averaging for accurate vibration + current readings.

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

#include <DHT.h>
#include <Wire.h>
#include <MPU6050.h>

#define DHT_PIN          2
#define DHT_TYPE         DHT11
#define ACS_PIN          A0

// ---- ACS712 settings ----------------------------------------
// Change ACS_SENSITIVITY based on your module:
//   ACS712-05B = 185.0   (5A  version)
//   ACS712-20A = 100.0   (20A version)  <-- most common
//   ACS712-30A =  66.0   (30A version)
#define ACS_SENSITIVITY  100.0   // mV/A  -- change if needed
#define VIB_SAMPLES      128     // samples for RMS vibration
#define CURR_SAMPLES     200     // samples for stable current

DHT dht(DHT_PIN, DHT_TYPE);
MPU6050 mpu;

// Store baseline vibration (measured at startup with machine off)
float vib_baseline_x = 0, vib_baseline_y = 0, vib_baseline_z = 0;

void calibrateVibration() {
  // Take 200 samples at rest to find baseline offset
  long sx = 0, sy = 0, sz = 0;
  for (int i = 0; i < 200; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    sx += ax; sy += ay; sz += az;
    delay(5);
  }
  vib_baseline_x = sx / 200.0;
  vib_baseline_y = sy / 200.0;
  vib_baseline_z = sz / 200.0;
}

void setup() {
  Serial.begin(9600);
  dht.begin();
  Wire.begin();
  mpu.initialize();
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2); // +-2g range
  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed!");
  }
  delay(2000);
  calibrateVibration(); // calibrate once at startup
}

void loop() {
  // ---- 1. Temperature (DHT11) ---------------------------------
  float temp = dht.readTemperature();
  if (isnan(temp)) temp = 25.0; // fallback

  // ---- 2. Vibration RMS (MPU6050) ----------------------------
  // Collect VIB_SAMPLES, subtract baseline, compute RMS magnitude
  float sum_sq = 0;
  for (int i = 0; i < VIB_SAMPLES; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    // Remove baseline offset
    float dx = (ax - vib_baseline_x) / 16384.0; // in g
    float dy = (ay - vib_baseline_y) / 16384.0;
    float dz = (az - vib_baseline_z) / 16384.0;
    // Magnitude squared (ignore gravity — already subtracted in baseline)
    sum_sq += dx*dx + dy*dy + dz*dz;
    delayMicroseconds(500); // ~2kHz sampling
  }
  float vib_g_rms = sqrt(sum_sq / VIB_SAMPLES); // g RMS
  float vib = vib_g_rms * 9.806; // convert to m/s2, display as reasonable units
  if (vib < 0.01) vib = 0.01; // floor

  // ---- 3. Current RMS (ACS712) --------------------------------
  // Read many samples, find midpoint (zero-current offset), compute RMS
  long sum = 0;
  int readings[CURR_SAMPLES];
  for (int i = 0; i < CURR_SAMPLES; i++) {
    readings[i] = analogRead(ACS_PIN);
    sum += readings[i];
    delayMicroseconds(200);
  }
  float midpoint = sum / (float)CURR_SAMPLES; // dynamic zero offset
  float curr_sum_sq = 0;
  for (int i = 0; i < CURR_SAMPLES; i++) {
    float v = ((readings[i] - midpoint) / 1023.0) * 5000.0; // mV deviation
    float a = v / ACS_SENSITIVITY;
    curr_sum_sq += a * a;
  }
  float current = sqrt(curr_sum_sq / CURR_SAMPLES); // RMS current in Amps
  if (current < 0.05) current = 0.0; // noise floor

  // ---- 4. Send over Serial ------------------------------------
  Serial.print("TEMP:");
  Serial.print(temp, 2);
  Serial.print(",VIB:");
  Serial.print(vib, 3);
  Serial.print(",CURR:");
  Serial.println(current, 3);

  delay(800); // ~1 reading per second
}
