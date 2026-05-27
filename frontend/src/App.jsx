import { useEffect, useState, useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ── MOCK SEEDS ───────────────────────────────────
const MOCK_ENERGY_SEED = [
  { time: "09:00:00", electricity: 390000, diesel: 78000 },
  { time: "09:00:03", electricity: 405000, diesel: 80000 },
  { time: "09:00:06", electricity: 412000, diesel: 82000 },
  { time: "09:00:09", electricity: 398000, diesel: 79000 },
  { time: "09:00:12", electricity: 421000, diesel: 83000 },
  { time: "09:00:15", electricity: 435000, diesel: 86000 },
  { time: "09:00:18", electricity: 428000, diesel: 84000 },
  { time: "09:00:21", electricity: 418000, diesel: 85000 },
];
const MOCK_MACHINE_SEED = [
  { time: "09:00:00", production: 15200, temperature: 70, machine_health: 95 },
  { time: "09:00:03", production: 15600, temperature: 71, machine_health: 94 },
  { time: "09:00:06", production: 15900, temperature: 72, machine_health: 94 },
  { time: "09:00:09", production: 16100, temperature: 73, machine_health: 93 },
  { time: "09:00:12", production: 15800, temperature: 71, machine_health: 94 },
  { time: "09:00:15", production: 16200, temperature: 74, machine_health: 93 },
  { time: "09:00:18", production: 16000, temperature: 72, machine_health: 94 },
  { time: "09:00:21", production: 16400, temperature: 73, machine_health: 92 },
];

// ── SEVERITY STYLES ──────────────────────────────
const SEV_COLOR = {
  CRITICAL: "text-red-600 bg-red-100 border border-red-300",
  HIGH: "text-orange-600 bg-orange-100 border border-orange-300",
  WARNING: "text-yellow-700 bg-yellow-100 border border-yellow-300",
  NORMAL: "text-green-700 bg-green-100 border border-green-300",
};
const SEV_DOT = {
  CRITICAL: "bg-red-600",
  HIGH: "bg-orange-500",
  WARNING: "bg-yellow-500",
  NORMAL: "bg-green-500",
};
const EVT_COLOR = {
  CRITICAL: "border-red-600 text-red-400",
  HIGH: "border-orange-500 text-orange-400",
  WARNING: "border-yellow-500 text-yellow-400",
  INFO: "border-gray-600 text-gray-400",
};

// ── WEATHER ICON ─────────────────────────────────
function weatherIcon(desc = "") {
  const d = desc.toLowerCase();
  if (d.includes("thunder")) return "⛈";
  if (d.includes("rain")) return "🌧";
  if (d.includes("drizzle")) return "🌦";
  if (d.includes("snow")) return "❄";
  if (d.includes("mist") || d.includes("fog") || d.includes("haze"))
    return "🌫";
  if (d.includes("cloud")) return "⛅";
  if (d.includes("clear")) return "☀";
  return "🌡";
}

// ─────────────────────────────────────────────────
function App() {
  const [liveData, setLiveData] = useState({
    electricity: 466000,
    diesel: 45000,
    production: 20600,
    temperature: 68,
    machine_health: 91,
  });

  const [weather, setWeather] = useState({
    temp_c: "--",
    feels_like_c: "--",
    humidity_pct: "--",
    description: "Loading...",
    wind_kmh: "--",
    last_updated: null,
    source: "initializing",
  });

  const [machines, setMachines] = useState({});
  const [insights, setInsights] = useState(["Initializing telemetry..."]);
  const [recommendations, setRecommendations] = useState([]);
  const [eventLog, setEventLog] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [energyGraph, setEnergyGraph] = useState(MOCK_ENERGY_SEED);
  const [machineGraph, setMachineGraph] = useState(MOCK_MACHINE_SEED);

  const demoRef = useRef(null);

  // ── DEMO FALLBACK ─────────────────────────────
  const startDemo = () => {
    if (demoRef.current) return;
    demoRef.current = setInterval(() => {
      setLiveData((prev) => {
        const next = {
          electricity: Math.min(
            1000000,
            Math.max(250000, prev.electricity + (Math.random() * 12000 - 5000)),
          ),
          diesel: Math.min(
            120000,
            Math.max(20000, prev.diesel + (Math.random() * 2000 - 800)),
          ),
          production: Math.min(
            28000,
            Math.max(8000, prev.production + (Math.random() * 1000 - 400)),
          ),
          temperature: Math.min(
            118,
            Math.max(40, prev.temperature + (Math.random() * 4 - 1.5)),
          ),
          machine_health: Math.min(
            100,
            Math.max(40, prev.machine_health + (Math.random() * 2 - 1.2)),
          ),
        };
        const now = new Date().toLocaleTimeString();
        setEnergyGraph((g) => {
          const u = [
            ...g,
            {
              time: now,
              electricity: Math.round(next.electricity),
              diesel: Math.round(next.diesel),
            },
          ];
          if (u.length > 12) u.shift();
          return u;
        });
        setMachineGraph((g) => {
          const u = [
            ...g,
            {
              time: now,
              production: Math.round(next.production),
              temperature: Math.round(next.temperature),
              machine_health: Math.round(next.machine_health),
            },
          ];
          if (u.length > 12) u.shift();
          return u;
        });
        return next;
      });
    }, 2000);
  };

  // ── WEBSOCKET ─────────────────────────────────
  useEffect(() => {
    const socket = new WebSocket("ws://127.0.0.1:8000/ws/live-data");
    socket.onopen = () => setWsConnected(true);
    socket.onmessage = (event) => {
      const p = JSON.parse(event.data);
      const now = new Date().toLocaleTimeString();

      setLiveData({
        electricity: p.electricity ?? 466000,
        diesel: p.diesel ?? 45000,
        production: p.production ?? 20600,
        temperature: p.temperature ?? 68,
        machine_health: p.machine_health ?? 91,
      });

      setEnergyGraph((g) => {
        const u = [
          ...g,
          { time: now, electricity: p.electricity ?? 0, diesel: p.diesel ?? 0 },
        ];
        if (u.length > 12) u.shift();
        return u;
      });
      setMachineGraph((g) => {
        const u = [
          ...g,
          {
            time: now,
            production: p.production ?? 0,
            temperature: p.temperature ?? 0,
            machine_health: p.machine_health ?? 0,
          },
        ];
        if (u.length > 12) u.shift();
        return u;
      });

      if (p.machines) setMachines(p.machines);
      if (Array.isArray(p.ai_operational_insights))
        setInsights(p.ai_operational_insights);
      if (Array.isArray(p.operational_recommendations))
        setRecommendations(p.operational_recommendations);
      if (Array.isArray(p.event_log)) setEventLog(p.event_log);
      if (p.ambient_weather) setWeather(p.ambient_weather);

      setLastUpdate(now);
    };
    socket.onerror = () => {
      setWsConnected(false);
      startDemo();
    };
    socket.onclose = () => setWsConnected(false);

    return () => {
      socket.close();
      if (demoRef.current) {
        clearInterval(demoRef.current);
        demoRef.current = null;
      }
    };
  }, []); // eslint-disable-line

  // ── ALERTS ───────────────────────────────────
  const electricityCritical = liveData.electricity > 800000;
  const dieselCritical = liveData.diesel > 100000;
  const temperatureCritical = liveData.temperature > 95;
  const healthCritical = liveData.machine_health < 60;
  const weatherHot = typeof weather.temp_c === "number" && weather.temp_c > 38;
  const allStable =
    !electricityCritical &&
    !dieselCritical &&
    !temperatureCritical &&
    !healthCritical;

  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#e7e3da] text-black">
      {/* ── HEADER ───────────────────────────── */}
      <div className="bg-[#111111] border-b-4 border-yellow-500 px-8 py-5 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-5xl font-black tracking-[0.2em] text-yellow-400">
            IRONCLAD
          </h1>
          <span
            className={`text-xs px-3 py-1 font-bold tracking-widest uppercase rounded-sm ${wsConnected ? "bg-green-500 text-black" : "bg-yellow-600 text-black"}`}
          >
            {wsConnected ? "● LIVE" : "◌ DEMO"}
          </span>
          {lastUpdate && (
            <span className="text-gray-500 text-xs tracking-widest font-mono">
              Updated {lastUpdate}
            </span>
          )}
        </div>
        <div className="flex gap-6 text-sm uppercase tracking-[0.2em] font-bold">
          <button className="bg-yellow-400 text-black px-5 py-3">
            Live Monitoring
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            Telemetry
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            Fleet Status
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            Event Log
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── ALERT BAR ────────────────────────── */}
        <div className="bg-[#111111] text-yellow-400 px-6 py-4 font-bold tracking-[0.2em] uppercase border-l-4 border-yellow-500 flex flex-wrap gap-4">
          {electricityCritical && <span>⚠ Extreme Electricity Usage</span>}
          {dieselCritical && <span>⚠ Diesel Consumption Elevated</span>}
          {temperatureCritical && <span>⚠ Thermal Critical</span>}
          {healthCritical && <span>⚠ Fleet Health Deteriorating</span>}
          {weatherHot && (
            <span>🌡 Extreme Ambient Heat — {weather.temp_c}°C Nagpur</span>
          )}
          {allStable && <span>✓ All Systems Stable</span>}
        </div>

        {/* ── KPI GRID + WEATHER CARD ───────────── */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-[2px] bg-black border-2 border-black">
          <div className="bg-[#e7e3da] p-6">
            <h2 className="text-xs uppercase tracking-[0.25em] text-gray-500 font-bold mb-4">
              Total Electricity
            </h2>
            <p className="text-4xl font-black text-red-700">
              ₹ {Math.round(liveData.electricity).toLocaleString()}
            </p>
          </div>

          <div className="bg-[#e7e3da] p-6">
            <h2 className="text-xs uppercase tracking-[0.25em] text-gray-500 font-bold mb-4">
              Boiler Diesel
            </h2>
            <p className="text-4xl font-black text-purple-700">
              ₹ {Math.round(liveData.diesel).toLocaleString()}
            </p>
          </div>

          <div className="bg-[#e7e3da] p-6">
            <h2 className="text-xs uppercase tracking-[0.25em] text-gray-500 font-bold mb-4">
              Total Production
            </h2>
            <p className="text-4xl font-black text-orange-700">
              {Math.round(liveData.production).toLocaleString()}{" "}
              <span className="text-lg">u</span>
            </p>
          </div>

          <div className="bg-[#e7e3da] p-6">
            <h2 className="text-xs uppercase tracking-[0.25em] text-gray-500 font-bold mb-4">
              Peak Temperature
            </h2>
            <p
              className={`text-4xl font-black ${liveData.temperature > 95 ? "text-red-700" : liveData.temperature > 85 ? "text-yellow-700" : "text-orange-700"}`}
            >
              {Math.round(liveData.temperature)}°C
            </p>
          </div>

          <div className="bg-[#e7e3da] p-6">
            <h2 className="text-xs uppercase tracking-[0.25em] text-gray-500 font-bold mb-4">
              Fleet Health
            </h2>
            <p
              className={`text-4xl font-black ${liveData.machine_health < 70 ? "text-red-700" : liveData.machine_health < 82 ? "text-yellow-700" : "text-green-700"}`}
            >
              {Math.round(liveData.machine_health)}%
            </p>
          </div>

          {/* ── WEATHER KPI CARD ─────────────────── */}
          <div
            className={`p-6 relative ${weatherHot ? "bg-orange-50" : "bg-[#e7e3da]"}`}
          >
            {/* source badge */}
            <div className="absolute top-3 right-3">
              <span
                className={`text-xs px-2 py-0.5 font-bold tracking-widest uppercase rounded-sm ${weather.source === "live" ? "bg-green-500 text-black" : "bg-gray-400 text-black"}`}
              >
                {weather.source === "live" ? "LIVE" : "—"}
              </span>
            </div>

            <h2 className="text-xs uppercase tracking-[0.25em] text-gray-500 font-bold mb-2">
              Ambient · Nagpur
            </h2>

            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl">
                {weatherIcon(weather.description)}
              </span>
              <p
                className={`text-4xl font-black leading-none ${weatherHot ? "text-orange-600" : "text-blue-700"}`}
              >
                {typeof weather.temp_c === "number"
                  ? `${weather.temp_c}°C`
                  : "--"}
              </p>
            </div>

            <p className="text-xs text-gray-500 font-semibold capitalize mb-1">
              {weather.description}
            </p>

            <div className="flex gap-3 text-xs text-gray-400 font-mono">
              <span>💧 {weather.humidity_pct}%</span>
              <span>💨 {weather.wind_kmh} km/h</span>
            </div>

            {weather.last_updated && (
              <p className="text-xs text-gray-400 font-mono mt-2">
                Updated {weather.last_updated}
              </p>
            )}

            <p className="text-xs text-gray-300 font-mono mt-1">
              Driving cooling load
            </p>
          </div>
        </div>

        {/* ── MACHINE FLEET TABLE ───────────────── */}
        {Object.keys(machines).length > 0 && (
          <div className="bg-white border-2 border-black">
            <div className="bg-[#111111] px-6 py-3 border-b-2 border-yellow-500">
              <h2 className="text-yellow-400 uppercase tracking-[0.3em] font-bold text-sm">
                Machine Fleet Status
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="bg-[#e7e3da] border-b border-black">
                    {[
                      "Machine",
                      "Electricity",
                      "Temperature",
                      "Health",
                      "Production",
                      "Severity",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs uppercase tracking-widest text-gray-500 font-bold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(machines).map(([key, m]) => (
                    <tr
                      key={key}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-gray-800">
                        {m.name}
                      </td>
                      <td className="px-4 py-3 text-red-700 font-bold">
                        ₹{Math.round(m.electricity).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            m.temperature > 95
                              ? "text-red-700 font-bold"
                              : m.temperature > 82
                                ? "text-yellow-700 font-bold"
                                : "text-gray-700"
                          }
                        >
                          {Math.round(m.temperature)}°C
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            m.machine_health < 65
                              ? "text-red-700 font-bold"
                              : m.machine_health < 80
                                ? "text-yellow-700 font-bold"
                                : "text-green-700 font-bold"
                          }
                        >
                          {Math.round(m.machine_health)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {m.production > 0
                          ? `${m.production.toLocaleString()} u`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 font-bold tracking-widest uppercase rounded ${SEV_COLOR[m.severity] || SEV_COLOR.NORMAL}`}
                        >
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${SEV_DOT[m.severity] || SEV_DOT.NORMAL}`}
                          />
                          {m.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CHARTS ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[2px] bg-black border-2 border-black">
          <div className="bg-[#e7e3da] p-8">
            <h2 className="text-sm uppercase tracking-[0.3em] text-gray-500 font-bold border-b border-black pb-4 mb-8">
              Energy Telemetry
            </h2>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={energyGraph}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={["dataMin - 20000", "dataMax + 20000"]}
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    formatter={(v, n) => [`₹${v.toLocaleString()}`, n]}
                    contentStyle={{ fontFamily: "monospace", fontSize: 11 }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="electricity"
                    stroke="#c0392b"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive
                    animationDuration={300}
                  />
                  <Line
                    type="monotone"
                    dataKey="diesel"
                    stroke="#8e44ad"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-[#e7e3da] p-8">
            <h2 className="text-sm uppercase tracking-[0.3em] text-gray-500 font-bold border-b border-black pb-4 mb-8">
              Machine Intelligence
            </h2>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={machineGraph}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={["dataMin - 500", "dataMax + 500"]}
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                  />
                  <Tooltip
                    contentStyle={{ fontFamily: "monospace", fontSize: 11 }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="production"
                    stroke="#d35400"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive
                    animationDuration={300}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f1c40f"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive
                    animationDuration={300}
                  />
                  <Line
                    type="monotone"
                    dataKey="machine_health"
                    stroke="#27ae60"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── INSIGHTS + EVENT LOG ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[2px] bg-black border-2 border-black">
          <div className="bg-black p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-yellow-400 uppercase tracking-[0.3em] font-bold text-sm">
                Operational Insights
              </h2>
              <span
                className={`text-xs px-2 py-1 font-bold tracking-widest uppercase rounded-sm ${wsConnected ? "bg-green-700 text-green-200" : "bg-gray-700 text-gray-400"}`}
              >
                {wsConnected ? "LIVE" : "STATIC"}
              </span>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {insights.map((item, i) => (
                <div
                  key={i}
                  className="bg-[#1a1a1a] border-l-4 border-red-500 p-4"
                >
                  <p className="text-gray-300 text-sm leading-7">{item}</p>
                </div>
              ))}
              {recommendations.map((item, i) => (
                <div
                  key={i}
                  className="bg-yellow-950 border-l-4 border-yellow-500 p-4"
                >
                  <p className="text-yellow-200 text-sm leading-7">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d0d0d] p-8">
            <h2 className="text-yellow-400 uppercase tracking-[0.3em] font-bold text-sm mb-6">
              Event Log
            </h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto font-mono pr-1">
              {eventLog.length === 0 && (
                <p className="text-gray-600 text-xs">
                  Awaiting operational events...
                </p>
              )}
              {eventLog.map((evt, i) => (
                <div
                  key={i}
                  className={`border-l-2 pl-3 py-1 ${EVT_COLOR[evt.severity] || EVT_COLOR.INFO}`}
                >
                  <span className="text-gray-600 text-xs mr-3">{evt.time}</span>
                  <span className="text-xs">{evt.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────── */}
        <div className="border-t-2 border-black pt-4 flex justify-between items-center text-xs font-mono text-gray-400">
          <span>IRONCLAD Industrial Telemetry Platform · Nagpur, India</span>
          <span>
            Weather:{" "}
            {weather.source === "live"
              ? "OpenWeatherMap Live"
              : "Fallback Mode"}{" "}
            · Cooling physics: ambient-driven · Fleet:{" "}
            {Object.keys(machines).length} machines
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
