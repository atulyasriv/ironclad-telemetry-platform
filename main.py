from fastapi import WebSocket, WebSocketDisconnect
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import random
import asyncio
import time
import httpx
import os

app = FastAPI()

# ==============================
# CORS
# ==============================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# OPENWEATHERMAP CONFIG
# Set your key via env var:
#   export OWM_API_KEY="your_key_here"
# Free tier: openweathermap.org
# ==============================

OWM_API_KEY = os.environ.get("OWM_API_KEY", "69e8a40fbbdd5484ec0ae319bae37b94")
OWM_URL     = "https://api.openweathermap.org/data/2.5/weather?q=Nagpur,IN&appid={key}&units=metric"

# ==============================
# AMBIENT WEATHER STATE
# Updated every 5 minutes
# Drives cooling system physics
# ==============================

ambient_weather = {
    "temp_c":          32.0,
    "feels_like_c":    35.0,
    "humidity_pct":    58,
    "description":     "partly cloudy",
    "wind_kmh":        12.0,
    "last_updated":    None,
    "source":          "initializing",   # "live" | "fallback"
}

async def fetch_weather():
    """Fetches real Nagpur weather every 5 minutes."""
    while True:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                res = await client.get(OWM_URL.format(key=OWM_API_KEY))
                if res.status_code == 200:
                    d = res.json()
                    ambient_weather["temp_c"]       = round(d["main"]["temp"],       1)
                    ambient_weather["feels_like_c"] = round(d["main"]["feels_like"], 1)
                    ambient_weather["humidity_pct"] = d["main"]["humidity"]
                    ambient_weather["description"]  = d["weather"][0]["description"].title()
                    ambient_weather["wind_kmh"]     = round(d["wind"]["speed"] * 3.6, 1)
                    ambient_weather["last_updated"] = time.strftime("%H:%M:%S")
                    ambient_weather["source"]       = "live"
                    print(f"[WEATHER] Updated — {ambient_weather['temp_c']}°C, {ambient_weather['description']}")
                else:
                    ambient_weather["source"] = "fallback"
                    print(f"[WEATHER] API error {res.status_code} — using fallback")
        except Exception as e:
            ambient_weather["source"] = "fallback"
            print(f"[WEATHER] Fetch failed: {e} — using fallback")

        await asyncio.sleep(300)   # re-fetch every 5 minutes

# ==============================
# MACHINE DEFINITIONS
# ==============================

machines = {
    "boiler": {
        "name":           "Boiler Unit",
        "electricity":    180000,
        "temperature":    82,
        "production":     0,
        "machine_health": 91,
        "diesel":         45000,
        "status":         "NORMAL",
        "severity":       "NORMAL",
    },
    "assembly_a": {
        "name":           "Assembly Line A",
        "electricity":    95000,
        "temperature":    68,
        "production":     8200,
        "machine_health": 94,
        "diesel":         0,
        "status":         "NORMAL",
        "severity":       "NORMAL",
    },
    "assembly_b": {
        "name":           "Assembly Line B",
        "electricity":    88000,
        "temperature":    65,
        "production":     7600,
        "machine_health": 89,
        "diesel":         0,
        "status":         "NORMAL",
        "severity":       "NORMAL",
    },
    "cooling": {
        "name":           "Cooling System",
        "electricity":    62000,
        "temperature":    44,
        "production":     0,
        "machine_health": 96,
        "diesel":         0,
        "status":         "NORMAL",
        "severity":       "NORMAL",
    },
    "packaging": {
        "name":           "Packaging Unit",
        "electricity":    41000,
        "temperature":    58,
        "production":     4800,
        "machine_health": 87,
        "diesel":         0,
        "status":         "NORMAL",
        "severity":       "NORMAL",
    },
}

# ==============================
# AGGREGATED FACTORY VIEW
# Preserves App.jsx chart compatibility
# ==============================

live_factory_data = {
    "electricity":    466000,
    "diesel":          45000,
    "production":      20600,
    "temperature":        68,
    "machine_health":     91,
}

# ==============================
# EVENT LOG
# ==============================

event_log      = []
MAX_EVENTS     = 20

def push_event(message: str, severity: str = "INFO"):
    event_log.append({
        "time":     time.strftime("%H:%M:%S"),
        "message":  message,
        "severity": severity,
    })
    if len(event_log) > MAX_EVENTS:
        event_log.pop(0)

# ==============================
# SEVERITY ENGINE
# ==============================

def compute_severity(electricity, temperature, machine_health) -> str:
    if temperature > 105 or machine_health < 55 or electricity > 900000:
        return "CRITICAL"
    if temperature > 90  or machine_health < 70 or electricity > 700000:
        return "HIGH"
    if temperature > 78  or machine_health < 82 or electricity > 500000:
        return "WARNING"
    return "NORMAL"

# ==============================
# CORRELATED TELEMETRY SIMULATOR
#
# Real ambient temperature from
# OpenWeatherMap drives cooling load:
#   higher ambient → harder cooling works
#   → higher electricity draw
#   → thermal pressure on nearby machines
# ==============================

async def simulate_factory():
    cooling_anomaly_ticks = 0

    while True:
        ambient = ambient_weather["temp_c"]   # real Nagpur temp

        # ── PRODUCTION DRIFT ─────────────────────
        for key in ["assembly_a", "assembly_b"]:
            m     = machines[key]
            drift = random.randint(-300, 500)
            m["production"] = max(4000, min(14000, m["production"] + drift))

        total_assembly = machines["assembly_a"]["production"] + machines["assembly_b"]["production"]
        machines["packaging"]["production"] = max(2000, min(8000,
            int(total_assembly * 0.24) + random.randint(-100, 100)))

        # ── ELECTRICITY SCALES WITH PRODUCTION ───
        for key in ["assembly_a", "assembly_b"]:
            m = machines[key]
            m["electricity"] = max(40000, min(220000,
                int(60000 + m["production"] * 3.8) + random.randint(-2000, 3000)))

        machines["packaging"]["electricity"] = max(20000, min(80000,
            int(machines["packaging"]["production"] * 5.2) + random.randint(-1000, 2000)))

        boiler_spike = 12000 if random.random() < 0.08 else 0
        machines["boiler"]["electricity"] = max(100000, min(320000,
            machines["boiler"]["electricity"] + random.randint(-4000, 6000) + boiler_spike))

        # ── COOLING LOAD DRIVEN BY REAL AMBIENT TEMP ──
        # Hotter outside → cooling works harder → more electricity
        ambient_load   = max(0, int((ambient - 25) * 800))   # 0 at 25°C, rises with heat
        health_penalty = int(8000 * (1 + (100 - machines["cooling"]["machine_health"]) / 100))
        machines["cooling"]["electricity"] = max(30000, min(150000,
            machines["cooling"]["electricity"]
            + random.randint(-1500, 2000)
            + ambient_load
            + health_penalty))

        # ── TEMPERATURE: ELECTRICITY PRESSURE + AMBIENT BLEED ──
        for key in machines:
            m             = machines[key]
            elec_pressure = (m["electricity"] - 60000) / 50000
            ambient_bleed = (ambient - 30) * 0.05   # real heat bleeds into factory
            temp_drift    = elec_pressure * 0.6 + ambient_bleed + random.uniform(-1.2, 1.8)
            m["temperature"] = max(35, min(118, round(m["temperature"] + temp_drift, 1)))

        # ── COOLING ANOMALY RANDOM EVENT ─────────
        if random.random() < 0.04 and cooling_anomaly_ticks == 0:
            cooling_anomaly_ticks = random.randint(4, 10)
            push_event("Cooling system anomaly initiated — thermal drift expected.", "WARNING")

        if cooling_anomaly_ticks > 0:
            machines["boiler"]["temperature"]     = min(118, machines["boiler"]["temperature"]     + random.uniform(1.5, 3.5))
            machines["assembly_a"]["temperature"] = min(118, machines["assembly_a"]["temperature"] + random.uniform(0.8, 2.0))
            machines["assembly_b"]["temperature"] = min(118, machines["assembly_b"]["temperature"] + random.uniform(0.8, 2.0))
            machines["cooling"]["machine_health"] = max(40,  machines["cooling"]["machine_health"] - random.uniform(0.5, 1.5))
            cooling_anomaly_ticks -= 1
            if cooling_anomaly_ticks == 0:
                push_event("Cooling system anomaly resolved.", "INFO")
        else:
            machines["cooling"]["machine_health"] = min(100, machines["cooling"]["machine_health"] + random.uniform(0, 0.4))
            for key in machines:
                machines[key]["temperature"] = max(35, machines[key]["temperature"] - random.uniform(0, 0.5))

        # ── HEALTH DEGRADES WITH HIGH TEMP ───────
        for key in machines:
            m           = machines[key]
            temp_stress = max(0, (m["temperature"] - 75) * 0.04)
            m["machine_health"] = max(40, min(100,
                round(m["machine_health"] + random.uniform(-0.3, 0.5) - temp_stress, 1)))

        # ── BOILER DIESEL ─────────────────────────
        machines["boiler"]["diesel"] = max(20000, min(120000,
            machines["boiler"]["diesel"] + random.randint(-800, 1200)))

        # ── SEVERITY PER MACHINE ──────────────────
        for key, m in machines.items():
            sev      = compute_severity(m["electricity"], m["temperature"], m["machine_health"])
            prev_sev = m["severity"]
            m["severity"] = sev
            m["status"]   = sev
            if sev != prev_sev:
                if sev in ("CRITICAL", "HIGH"):
                    push_event(f"{m['name']} severity escalated to {sev}.", sev)
                elif sev == "NORMAL" and prev_sev in ("CRITICAL", "HIGH", "WARNING"):
                    push_event(f"{m['name']} returned to normal operation.", "INFO")

        # ── AGGREGATE FOR CHART COMPATIBILITY ────
        live_factory_data["electricity"]    = sum(m["electricity"]    for m in machines.values())
        live_factory_data["diesel"]         = machines["boiler"]["diesel"]
        live_factory_data["production"]     = sum(m["production"]     for m in machines.values())
        live_factory_data["temperature"]    = round(max(m["temperature"] for m in machines.values()), 1)
        live_factory_data["machine_health"] = round(sum(m["machine_health"] for m in machines.values()) / len(machines), 1)

        await asyncio.sleep(3)

# ==============================
# RULE-BASED INSIGHT ENGINE
# ==============================

def generate_insights():
    insights        = []
    recommendations = []
    ambient         = ambient_weather["temp_c"]

    # ── WEATHER-AWARE INSIGHT ─────────────────
    if ambient > 38:
        insights.append(f"Ambient temperature at {ambient}°C — extreme heat increasing cooling load across factory floor.")
        recommendations.append("Consider reducing non-critical machine runtime during peak heat hours.")
    elif ambient > 32:
        insights.append(f"Ambient temperature elevated at {ambient}°C — monitoring cooling system load.")

    # ── PER-MACHINE ───────────────────────────
    for key, m in machines.items():
        name = m["name"]
        if m["temperature"] > 100:
            insights.append(f"CRITICAL: {name} at {m['temperature']}°C — thermal threshold exceeded.")
            recommendations.append(f"Emergency cooling inspection required for {name}.")
        elif m["temperature"] > 88:
            insights.append(f"WARNING: {name} running hot at {m['temperature']}°C.")
            recommendations.append(f"Inspect ventilation around {name}.")

        if m["machine_health"] < 60:
            insights.append(f"CRITICAL: {name} health at {m['machine_health']}% — maintenance required.")
            recommendations.append(f"Schedule emergency maintenance for {name}.")
        elif m["machine_health"] < 75:
            insights.append(f"WARNING: {name} health declining at {m['machine_health']}%.")
            recommendations.append(f"Preventive maintenance recommended for {name}.")

        if key in ("assembly_a", "assembly_b"):
            if m["production"] < 5000:
                insights.append(f"{name} throughput critically low — {m['production']:,} units.")
                recommendations.append(f"Investigate bottleneck on {name}.")
            elif m["production"] > 12000:
                insights.append(f"{name} at peak throughput — {m['production']:,} units.")

    # ── FACTORY-WIDE ──────────────────────────
    total_elec = live_factory_data["electricity"]
    total_prod = live_factory_data["production"]
    avg_health = live_factory_data["machine_health"]

    if total_elec > 850000:
        insights.append(f"Factory-wide electricity critical: ₹{total_elec:,}.")
        recommendations.append("Cross-reference production vs electricity draw to identify inefficient units.")
    elif total_elec > 650000:
        insights.append(f"Electricity trending high at ₹{total_elec:,}.")

    if total_prod > 0:
        cpu = round(total_elec / total_prod, 1)
        if cpu > 40:
            insights.append(f"Cost-per-unit elevated at ₹{cpu} — energy outpacing production.")
            recommendations.append("Audit idle machine electricity draw during low-production periods.")
        elif cpu < 25:
            insights.append(f"Cost-per-unit efficient at ₹{cpu}. Production-energy ratio healthy.")

    if avg_health > 90:
        insights.append(f"Fleet health strong at {avg_health}%.")
    elif avg_health < 70:
        insights.append(f"Fleet health degraded at {avg_health}%. Multiple machines need attention.")

    if machines["cooling"]["machine_health"] < 75:
        insights.append("Cooling system degradation — thermal pressure may spread factory-wide.")
        recommendations.append("Prioritize cooling inspection to prevent cascade thermal failures.")

    if not insights:
        insights.append("All factory systems operating within normal parameters.")
    if not recommendations:
        recommendations.append("Continue telemetry monitoring. No immediate action required.")

    return insights, recommendations

# ==============================
# STARTUP
# ==============================

@app.on_event("startup")
async def startup_event():
    push_event("IRONCLAD telemetry platform initialized.", "INFO")
    push_event("Factory simulation engine started.", "INFO")
    asyncio.create_task(simulate_factory())
    asyncio.create_task(fetch_weather())     # real weather task

# ==============================
# WEBSOCKET
# ==============================

@app.websocket("/ws/live-data")
async def websocket_live_data(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            insights, recommendations = generate_insights()
            payload = {
                # legacy fields — charts unchanged
                "electricity":    live_factory_data["electricity"],
                "diesel":         live_factory_data["diesel"],
                "production":     live_factory_data["production"],
                "temperature":    live_factory_data["temperature"],
                "machine_health": live_factory_data["machine_health"],
                # new fields
                "machines":                    machines,
                "ai_operational_insights":     insights,
                "operational_recommendations": recommendations,
                "ai_loading":                  False,
                "event_log":                   list(reversed(event_log)),
                "ambient_weather":             ambient_weather,
            }
            await websocket.send_json(payload)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass

# ==============================
# REST ENDPOINTS
# ==============================

@app.get("/live-factory-data")
async def get_live_factory_data():
    return JSONResponse(content=live_factory_data)

@app.get("/weather")
async def get_weather():
    return JSONResponse(content=ambient_weather)

@app.get("/machines")
async def get_machines():
    return JSONResponse(content=machines)

@app.get("/events")
async def get_events():
    return JSONResponse(content=list(reversed(event_log)))