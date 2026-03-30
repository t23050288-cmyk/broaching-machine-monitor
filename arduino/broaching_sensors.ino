/*
  Broaching Machine Sensor Sketch
  ================================
  Reads DHT11 (temperature), MPU6050 (vibration), ACS712 (current)
  and sends combined readings over Serial every 1 second.

  Wiring:
    DHT11  DATA pin  → Arduino pin 2
    MPU6050 SDA      → Arduino A4
    MPU6050 SCL      → Arduino A5
    MPU6050 VCC      → 3.3V
    MPU6050 GND      → GND
    ACS712  OUT      → Arduino A0
    ACS712  VCC      → 5V
    ACS712  GND      → GND

  Required Libraries (install via Arduino IDE > Sketch > Include Library > Manage Libraries):
    - DHT sensor library by Adafruit
    - Adafruit Unified Sensor
    - MPU6050 by Electronic Cats  (or "MPU6050" by Jeff Rowberg)
    - Wire (built-in)

  Output format (one line per second):
    TEMP:25.30,VIB:0.45,CURR:2.10
*/

#include <DHT.h>
#include <Wire.h>
#include <MPU6050.h>

// ── Pin definitions ──────────────────────────────────────────
#define DHT_PIN     2
#define DHT_TYPE    DHT11
#define ACS_PIN     A0

// ── ACS712 calibration ───────────────────────────────────────
// For ACS712-05B (5A): sensitivity = 185 mV/A
// For ACS712-20A     : sensitivity = 100 mV/A  ← change if yours is 20A
// For ACS712-30A     : sensitivity =  66 mV/A
#define ACS_SENSITIVITY  185.0   // mV per Amp
#define ACS_OFFSET       2500.0  // mV at zero current (≈ Vcc/2 = 2500mV)

// ── Objects ──────────────────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);
MPU6050 mpu;

void setup() {
  Serial.begin(9600);
  dht.begin();

  Wire.begin();
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed!");
  }

  delay(2000); // let sensors stabilise
}

void loop() {
  // ── 1. Temperature (DHT11) ──────────────────────────────────
  float temp = dht.readTemperature(); // Celsius
  if (isnan(temp)) temp = 0.0;

  // ── 2. Vibration (MPU6050 – accel magnitude) ────────────────
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  // Convert raw to g (±2g range → 16384 LSB/g)
  float ax_g = ax / 16384.0;
  float ay_g = ay / 16384.0;
  float az_g = az / 16384.0;
  // Magnitude minus gravity component (subtract 1g baseline)
  float vib = sqrt(ax_g*ax_g + ay_g*ay_g + az_g*az_g) - 1.0;
  if (vib < 0) vib = 0;
  // Scale to mm/s² (rough: 1g ≈ 9806 mm/s²)
  vib = vib * 9806.0;

  // ── 3. Current (ACS712) ─────────────────────────────────────
  // Average 50 samples to reduce noise
  long sum = 0;
  for (int i = 0; i < 50; i++) {
    sum += analogRead(ACS_PIN);
    delay(1);
  }
  float adc_avg = sum / 50.0;
  float voltage_mV = (adc_avg / 1023.0) * 5000.0; // 5V Arduino
  float current = (voltage_mV - ACS_OFFSET) / ACS_SENSITIVITY;
  if (current < 0) current = 0; // clamp negatives for DC measurement

  // ── 4. Send over Serial ─────────────────────────────────────
  Serial.print("TEMP:");
  Serial.print(temp, 2);
  Serial.print(",VIB:");
  Serial.print(vib, 2);
  Serial.print(",CURR:");
  Serial.println(current, 2);

  delay(1000); // 1 reading per second
}
