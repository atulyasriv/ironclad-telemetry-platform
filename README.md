# IRONCLAD — Real-Time Industrial Telemetry Platform

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-teal)
![React](https://img.shields.io/badge/React-18+-61dafb)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

A real-time industrial IoT telemetry monitoring platform that streams live factory machine data via WebSockets, detects operational anomalies through a rule-based severity engine, and integrates live ambient weather data to drive physically correlated factory simulations.

> Built as a portfolio project demonstrating real-time systems architecture, correlated telemetry simulation, and event-driven operational intelligence — without LLMs or autonomous AI.

---

## Live Demo

> Screenshot

![IRONCLAD Dashboard](./screenshots/dashboard.png)

---

## Architecture

```
OpenWeatherMap API (Nagpur)
        │
        ▼ every 5 min
┌─────────────────────────────┐
│     FastAPI Backend         │
│                             │
│  ┌─────────────────────┐    │
│  │  Factory Simulator  │    │
│  │  (correlated physics│    │
│  │   5 machines)       │    │
│  └────────┬────────────┘    │
│           │                 │
│  ┌────────▼────────────┐    │
│  │  Severity Engine    │    │
│  │  Rule-based Insights│    │
│  │  Event Log          │    │
│  └────────┬────────────┘    │
│           │                 │
│  ┌────────▼────────────┐    │
│  │  WebSocket Stream   │◄───┘
│  │  /ws/live-data      │
│  │  2s interval        │
│  └────────┬────────────┘    │
└───────────┼─────────────────┘
            │
            ▼
┌─────────────────────────────┐
│     React Frontend          │
│                             │
│  KPI Cards  │  Fleet Table  │
│  Charts     │  Event Log    │
│  Insights   │  Weather Card │
└─────────────────────────────┘
```

---

## Key Features

### Correlated Telemetry Physics
Unlike naive random-walk simulations, IRONCLAD models causal industrial relationships:

```
Production ↑  →  Electricity ↑
Electricity ↑  →  Temperature slowly ↑
Temperature ↑  →  Machine Health slowly ↓
Cooling Anomaly  →  Thermal spike cascades to Boiler + Assembly Lines
Ambient Heat (real) →  Cooling Load ↑  →  Electricity ↑
```

### Multi-Machine Fleet
Five independently simulated machines with correlated physics:

| Machine | Metrics | Notes |
|---|---|---|
| Boiler Unit | Electricity, Temperature, Health, Diesel | Diesel-consuming, thermal anchor |
| Assembly Line A | Electricity, Temperature, Health, Production | Primary output driver |
| Assembly Line B | Electricity, Temperature, Health, Production | Secondary output driver |
| Cooling System | Electricity, Temperature, Health | Driven by real ambient weather |
| Packaging Unit | Electricity, Temperature, Health, Production | Scales with assembly output |

### Real Ambient Data Integration
Cooling System electricity load is driven by **live Nagpur weather** via OpenWeatherMap:

```python
ambient_load = max(0, int((ambient_temp_c - 25) * 800))
# 0 extra load at 25°C baseline
# +10,400W extra load at 38°C Nagpur summer peak
```

This is a **digital twin pattern** — real environmental data feeding a correlated simulation. In production, the simulator would be replaced by IoT sensors, SCADA systems, or MQTT streams.

### Rule-Based Severity Engine
No LLMs. Deterministic, explainable, fast:

| Severity | Conditions |
|---|---|
| CRITICAL | Temp > 105°C OR Health < 55% OR Electricity > ₹9,00,000 |
| HIGH | Temp > 90°C OR Health < 70% OR Electricity > ₹7,00,000 |
| WARNING | Temp > 78°C OR Health < 82% OR Electricity > ₹5,00,000 |
| NORMAL | All within threshold |

### Event Log Engine
Operational events fire only on **state transitions** — severity escalations, anomaly starts/recoveries. Rolling 20-event history streamed via WebSocket.

### WebSocket Streaming
Single WebSocket endpoint streams everything at 2-second intervals:
- Live KPI aggregates (chart-compatible)
- Per-machine fleet states
- Rule-based operational insights
- Recommendations
- Event log
- Live weather data

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, FastAPI, asyncio |
| Realtime | WebSockets (native FastAPI) |
| Frontend | React 18, Recharts, Tailwind CSS |
| Weather | OpenWeatherMap API (free tier) |
| HTTP Client | httpx (async) |
| Package Manager | npm, pip |

---

## Project Structure

```
ironclad/
├── backend/
│   ├── main.py           # FastAPI app, simulator, WebSocket, weather
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   └── App.jsx       # React dashboard
│   ├── package.json
│   └── tailwind.config.js
├── tests/
│   └── test_main.py      # pytest test suite
├── screenshots/
│   └── dashboard.png
└── README.md
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Free API key from [openweathermap.org](https://openweathermap.org/api)

### Backend Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/ironclad.git
cd ironclad/backend

# Install dependencies
pip install fastapi uvicorn httpx

# Set your OpenWeatherMap API key
export OWM_API_KEY="your_key_here"

# Run the server
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`

### Frontend Setup

```bash
cd ironclad/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at `http://localhost:5173`

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OWM_API_KEY` | Yes | OpenWeatherMap free tier key |

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/ws/live-data` | WebSocket | Full telemetry stream at 2s intervals |
| `/live-factory-data` | GET | Current aggregated factory snapshot |
| `/machines` | GET | All machine states |
| `/weather` | GET | Current ambient weather state |
| `/events` | GET | Recent operational event log |

### WebSocket Payload Schema

```json
{
  "electricity": 573714,
  "diesel": 45512,
  "production": 23670,
  "temperature": 118.0,
  "machine_health": 87.0,
  "machines": {
    "boiler": {
      "name": "Boiler Unit",
      "electricity": 207480,
      "temperature": 118.0,
      "machine_health": 76.0,
      "diesel": 45512,
      "production": 0,
      "severity": "CRITICAL",
      "status": "CRITICAL"
    }
  },
  "ai_operational_insights": ["CRITICAL: Boiler Unit at 118°C..."],
  "operational_recommendations": ["Emergency cooling inspection required..."],
  "event_log": [
    { "time": "11:41:22", "message": "Boiler Unit severity escalated to CRITICAL.", "severity": "CRITICAL" }
  ],
  "ambient_weather": {
    "temp_c": 32.0,
    "humidity_pct": 58,
    "description": "Partly Cloudy",
    "wind_kmh": 12.0,
    "last_updated": "11:40:00",
    "source": "live"
  },
  "ai_loading": false
}
```

---

## Running Tests

```bash
cd backend
pip install pytest pytest-asyncio httpx

pytest tests/ -v
```

Test coverage includes:
- Severity engine correctness across all threshold boundaries
- Simulation bounds — no metric ever exceeds defined safety limits
- WebSocket payload schema validation
- Insight engine fires correctly on anomalous conditions
- Event log state transition logic

---

## Production Replacement Guide

IRONCLAD is architected so the simulator is the **only layer** that changes in production:

| Simulator Component | Production Replacement |
|---|---|
| `random.randint()` fluctuations | IoT sensor MQTT stream |
| `simulate_factory()` coroutine | SCADA / PLC data adapter |
| `fetch_weather()` | Additional real sensor feeds |
| SQLite (if added) | InfluxDB / TimescaleDB time-series store |
| Rule-based insights | ML anomaly detection (Isolation Forest, LSTM) |

The WebSocket layer, React frontend, severity engine, and event log require **zero changes** for real hardware integration.

---

## Design Decisions

**Why no LLM/Gemini?**
Rule-based insights are deterministic, explainable, and zero-latency. Every insight maps directly to a threshold condition. LLMs add cost, latency, and rate-limit fragility for a task that structured logic handles better.

**Why correlated physics instead of independent random noise?**
Independent noise produces fake-looking data — temperature randomly increasing while electricity decreases makes no industrial sense. Correlated physics makes the simulation believable and the anomaly detection meaningful.

**Why WebSocket over polling?**
Telemetry systems require push-based streaming. REST polling at 2-second intervals would be 30 HTTP requests/minute per client. WebSocket maintains one persistent connection with server-controlled push cadence.

**Why event-driven severity transitions instead of continuous state broadcast?**
Events should be meaningful. Broadcasting "NORMAL" 30 times/minute creates noise. Firing only on state transitions creates a signal — exactly how industrial SCADA event logs work.

---

## Future Roadmap

- [ ] Deploy backend to Railway / Render
- [ ] Deploy frontend to Vercel
- [ ] Add InfluxDB for time-series persistence
- [ ] Add pytest integration test suite
- [ ] Historical trend charts (last 24h)
- [ ] Multi-factory support
- [ ] MQTT adapter for real IoT sensor integration
- [ ] Predictive maintenance scoring (rolling degradation rate)

---

## Author

**Atulya Srivastava**
Third Year CS Student · Mumbai, India
[GitHub](https://github.com/atulyasriv) 


