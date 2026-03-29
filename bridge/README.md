# Sensor Bridge Setup (Windows)

## 1. Install dependencies
```
pip install pyserial websockets aiohttp
```

## 2. Connect USB sensors
Plug in your 3 sensors. Check Device Manager → Ports for COM numbers.

## 3. Configure (optional)
Open `sensor_bridge.py`, set your ports:
```python
TEMP_PORT    = 'COM3'
VIB_PORT     = 'COM4'
CURRENT_PORT = 'COM5'
```
Leave as `None` to auto-detect.

## 4. Run
```
python sensor_bridge.py
```
With AI (optional):
```
set AI_API_KEY=sk-your-openai-key
python sensor_bridge.py
```

## 5. Open the browser app
The app auto-connects to `ws://localhost:8765/ws`.
You'll see a green **LIVE** badge when sensors are connected.

## Sensor serial format
Each sensor sends one line per reading:
- `79.5` or `TEMP:79.5` (temperature in °C)
- `24.3` or `VIB:24.3`  (vibration in mm/s²)
- `38.7` or `CURR:38.7` (current in Amps)

## Arduino example
```cpp
void loop() {
  float temp = readMyTempSensor();
  Serial.print("TEMP:");
  Serial.println(temp);
  delay(1000);
}
```
