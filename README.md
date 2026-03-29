# 🔧 Broaching Machine Monitor

A real-time industrial monitoring dashboard for broaching machines — built with React, Vite, Tailwind CSS, and Recharts.

![Dashboard Preview](./docs/preview.png)

## Features

- **Live Dashboard** — real-time KPIs across all machines (efficiency, parts count, uptime, faults)
- **Machine Detail** — per-machine sensor gauges, live trend charts, and alert history
- **Analytics** — OEE scores, radar health chart, production breakdown, trend comparisons
- **Alert Center** — filterable alert log with acknowledge functionality
- **Settings** — configurable thresholds and notification preferences
- **Dark Industrial UI** — cyan/green accent palette, JetBrains Mono, animated status indicators

## Tech Stack

| Layer      | Technology                    |
|------------|-------------------------------|
| Framework  | React 18 + Vite               |
| Styling    | Tailwind CSS 3                |
| Charts     | Recharts                      |
| Routing    | React Router v6               |
| Icons      | Lucide React                  |
| Data       | Simulated real-time (2s tick) |

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Monitored Sensors

| Sensor             | Unit   | Warn  | Critical |
|--------------------|--------|-------|----------|
| Temperature        | °C     | 70    | 85       |
| Vibration          | mm/s   | 3.0   | 4.0      |
| Hydraulic Pressure | bar    | <130  | <110     |
| Spindle Speed      | RPM    | —     | —        |
| Feed Rate          | mm/min | —     | —        |
| Oil Level          | %      | <30   | <15      |
| Motor Current      | A      | 32    | 36       |
| Cycle Time         | s      | 25    | 30       |

## Project Structure

```
src/
├── components/
│   ├── Header.jsx        # Top bar with live clock & alert bell
│   ├── Sidebar.jsx       # Navigation with connection status
│   ├── MachineCard.jsx   # Machine summary card
│   ├── SensorGauge.jsx   # Animated sensor gauge
│   └── LiveChart.jsx     # Recharts line chart wrapper
├── pages/
│   ├── Dashboard.jsx     # Operations overview
│   ├── Machines.jsx      # Machine list
│   ├── MachineDetail.jsx # Per-machine diagnostics
│   ├── Analytics.jsx     # Charts and OEE
│   ├── Alerts.jsx        # Alert management
│   └── Settings.jsx      # Configuration
├── hooks/
│   └── useMachineData.js # Real-time data simulation hook
├── data/
│   └── mockData.js       # Data generators
└── utils/
    └── helpers.js        # Colors, labels, threshold logic
```

## Integrating Real Data

Replace the simulation in `src/hooks/useMachineData.js` with actual API/WebSocket calls:

```js
// Example: WebSocket connection
const ws = new WebSocket('ws://your-plc-gateway:8080/machines');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setMachineStates(data);
};
```

## License

MIT
