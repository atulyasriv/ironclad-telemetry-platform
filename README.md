# IRONCLAD: Real-Time Industrial Telemetry Platform

A real-time monitoring dashboard for a simulated factory. A FastAPI backend simulates five machines with correlated telemetry, classifies their condition with a rule-based severity engine, and streams everything to a React frontend over a WebSocket. Live ambient weather data from OpenWeatherMap feeds into the cooling system's load.

> **Note:** All machine telemetry is **simulated**. Only the ambient weather data is real. This is a portfolio project built to demonstrate real-time system design, not a production monitoring tool.

**Live demo:** https://ironclad-telemetry-platform.vercel.app
<!-- TODO: confirm the demo's backend is reachable. If the WebSocket backend is not deployed, say so here. -->

<!-- TODO: add a screenshot. Create a screenshots/ folder, add dashboard.png, then uncomment:
![IRONCLAD Dashboard](screenshots/dashboard.png)
-->

---

## Architecture

```
OpenWeatherMap API (Nagpur)
        |
        v  every 5 min
+-----------------------------+
|     FastAPI Backend         |
|                             |
|  Factory Simulator          |
|  (correlated, 5 machines)   |
|          |                  |
|  Severity Engine            |
|  Rule-based insights        |
|  Event log                  |
|          |                  |
|  WebSocket /ws/live-data    |
|  (2 s interval)             |
+-----------+-----------------+
            |
            v
+-----------------------------+
|     React Frontend          |
|  KPI cards, fleet table,    |
|  charts, event log,         |
|  insights, weather card     |
+-----------------------------+
```

## Features

### Correlated telemetry simulation
Instead of independent random noise, the simulator models cause and effect:

```
Production up      -> Electricity up
Electricity up     -> Temperature slowly up
Temperature up     -> Machine health slowly down
Cooling anomaly    -> Thermal spike spreads to Boiler and Assembly Lines
Ambient heat       -> Cooling load up -> Electricity up
```

### Five simulated machines

| Machine | Metrics |
|---|---|
| Boiler Unit | Electricity, Temperature, Health, Diesel |
| Assembly Line A | Electricity, Temperature, Health, Production |
| Assembly Line B | Electricity, Temperature, Health, Production |
| Cooling System | Electricity, Temperature, Health |
| Packaging Unit | Electricity, Temperature, Health, Production |

### Live weather input
The cooling system's electricity load depends on real ambient temperature for Nagpur from OpenWeatherMap:

```python
ambient_load = max(0, int((ambient_temp_c - 25) * 800))
# 0 extra load at 25 C, about +10,400 W at 38 C
```

If the weather API is unavailable, the simulator falls back to a default value. <!-- TODO: confirm this fallback exists in main.py, or delete this sentence. -->

### Rule-based severity engine
Deterministic and explainable, with no machine learning involved:

| Severity | Conditions (any one) |
|---|---|
| CRITICAL | Temp > 105 C, Health < 55%, or Electricity > 9,00,000 |
| HIGH | Temp > 90 C, Health < 70%, or Electricity > 7,00,000 |
| WARNING | Temp > 78 C, Health < 82%, or Electricity > 5,00,000 |
| NORMAL | All values within thresholds |

### Event log
Events are logged only on state changes (severity escalations, anomaly start and recovery). The most recent 20 events are included in the stream.

### WebSocket streaming
One endpoint pushes aggregate KPIs, per-machine state, insights, recommendations, the event log and weather every 2 seconds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, FastAPI, asyncio |
| Realtime | FastAPI WebSockets |
| Frontend | React 18, Recharts, Tailwind CSS |
| Weather | OpenWeatherMap API (free tier) |
| HTTP client | httpx |
| Storage | SQLite file (`factory_data.db`) <!-- TODO: state what it stores, or remove it from the repo --> |

## Repository Layout

```
ironclad-telemetry-platform/
├── main.py            # FastAPI app: simulator, severity engine, WebSocket, weather
├── requirements.txt   # Python dependencies
├── factory_data.db    # SQLite database <!-- TODO: explain or remove -->
├── uploads/           # <!-- TODO: explain what this folder is for, or remove -->
├── frontend/          # React dashboard
└── README.md
```

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- A free API key from https://openweathermap.org/api

### Backend

```bash
git clone https://github.com/atulyasriv/ironclad-telemetry-platform.git
cd ironclad-telemetry-platform

pip install -r requirements.txt

# macOS / Linux
export OWM_API_KEY="your_key_here"
# Windows PowerShell
# $env:OWM_API_KEY="your_key_here"

uvicorn main:app --reload
```

The backend runs at http://127.0.0.1:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at http://localhost:5173 <!-- TODO: confirm the port after running it -->

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `OWM_API_KEY` | Yes | OpenWeatherMap API key |

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/ws/live-data` | WebSocket | Full telemetry stream every 2 s |
| `/live-factory-data` | GET | Current aggregated factory snapshot |
| `/machines` | GET | All machine states |
| `/weather` | GET | Current ambient weather |
| `/events` | GET | Recent event log |

<!-- TODO: open main.py and confirm each endpoint above exists and the names match exactly. -->

### Example stream payload

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
  "ai_operational_insights": ["CRITICAL: Boiler Unit at 118 C..."],
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

Note: the field names `ai_operational_insights` and `ai_loading` are historical. The insights are produced by deterministic rules, not by an AI model.

## Design Decisions

**Why rule-based insights?** Every insight maps to a threshold, so it is explainable, instant and free of API costs or rate limits.

**Why correlated simulation?** Independent noise gives unrealistic data, such as temperature rising while electricity falls. Causal links make the anomalies meaningful.

**Why WebSockets over polling?** Telemetry is push-based. One persistent connection replaces about 30 requests a minute per client.

**Why log only state transitions?** Repeating "NORMAL" every 2 seconds is noise. Logging changes gives a useful signal, as in industrial event logs.

## Limitations

- All machine data is simulated, not read from real sensors.
- Thresholds are illustrative and not calibrated to real equipment.
- No automated tests are included yet.
- No authentication on the API or WebSocket.

## Roadmap

- [ ] Automated tests (severity thresholds, simulation bounds, payload schema)
- [ ] Time-series storage (e.g. InfluxDB or TimescaleDB)
- [ ] Historical trend charts
- [ ] MQTT adapter for real sensor input
- [ ] Predictive maintenance scoring

## Author

**[YOUR NAME]**, Third-Year Student, Mumbai, India
[GitHub](https://github.com/atulyasriv)
