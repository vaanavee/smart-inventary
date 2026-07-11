import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";
import { monitorApi } from "../api/monitorClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Box, Play, RefreshCw, Eye, CheckCircle2 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";

  // State with mockup data fallbacks in case APIs are empty/offline
  const [totalProducts, setTotalProducts] = useState(248);
  const [currentEntries, setCurrentEntries] = useState([
    { employee_name: "Vishali Nair", room: "Room 1", entry_time: "09:12" },
    { employee_name: "Arjun Das", room: "Room 2", entry_time: "09:41" }
  ]);
  const [workers, setWorkers] = useState([
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }
  ]);
  const [movements, setMovements] = useState([
    { employee_name: "Vishali Nair", product_name: "Bosch GSB 12V Drill", product_id: "PRD-0412", action: "OUT", quantity: 3, room: "Room 2", rack: "A", entry_time: "09:14", source: "auto" },
    { employee_name: "Arjun Das", product_name: "Makita Angle Grinder", product_id: "PRD-0355", action: "TRANSFER", quantity: 2, room: "Room 2", rack: "B", entry_time: "09:41", source: "auto" },
    { employee_name: "— unresolved —", product_name: "2.5mm² Copper Wire", product_id: "PRD-0207", action: "OUT", quantity: 5, room: "Room 3", rack: "C", entry_time: "09:47", source: "unresolved" },
    { employee_name: "Vishal Kumar", product_name: "M8 Hex Bolts (Box)", product_id: "PRD-0188", action: "IN", quantity: 20, room: "Room 1", rack: "B", entry_time: "09:05", source: "auto" },
    { employee_name: "Vaanavee R.", product_name: "LED Panel 18W", product_id: "PRD-0533", action: "OUT", quantity: 6, room: "Room 3", rack: "D", entry_time: "08:58", source: "vision" }
  ]);
  const [lowStock, setLowStock] = useState([
    { name: "Cordless Impact Driver", product_id: "PRD-0560", room: "Room 2", rack: "C", current_stock: 9, minimum_stock: 50 },
    { name: "Makita Angle Grinder", product_id: "PRD-0355", room: "Room 2", rack: "B", current_stock: 18, minimum_stock: 50 },
    { name: "LED Panel 18W", product_id: "PRD-0533", room: "Room 3", rack: "D", current_stock: 27, minimum_stock: 50 },
    { name: "Bosch GSB 12V Drill", product_id: "PRD-0412", room: "Room 2", rack: "A", current_stock: 34, minimum_stock: 50 },
    { name: "2.5mm² Copper Wire", product_id: "PRD-0207", room: "Room 3", rack: "C", current_stock: 42, minimum_stock: 50 }
  ]);
  const [alerts, setAlerts] = useState([
    { id: 1, severity: "critical", message: "CCTV detected a person in Room 2 at 09:47 with no matching RFID tap. A QR movement (PRD-0207) was recorded in the same window." }
  ]);
  const [topProducts, setTopProducts] = useState([
    { product: "2.5mm² Copper Wire", count: 86 },
    { product: "LED Panel 18W", count: 70 },
    { product: "Bosch GSB 12V Drill", count: 54 },
    { product: "Makita Angle Grinder", count: 39 },
    { product: "M8 Hex Bolts (Box)", count: 30 }
  ]);

  const [currentTime, setCurrentTime] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = () => {
    setIsRefreshing(true);
    const todayStr = new Date().toISOString().slice(0, 10);

    // Fetch dynamic database counts
    monitorApi.get("/products")
      .then((res) => { if (res && res.length) setTotalProducts(res.length); })
      .catch(() => {});

    monitorApi.get("/room-entries/current")
      .then((res) => { if (res) setCurrentEntries(res); })
      .catch(() => {});

    api.get("/workers")
      .then((res) => { if (res) setWorkers(res); })
      .catch(() => {});

    monitorApi.get(`/movements?date=${todayStr}`)
      .then((res) => { if (res && res.length) setMovements(res); })
      .catch(() => {});

    api.get("/inventory/low-stock")
      .then((res) => { if (res && res.length) setLowStock(res); })
      .catch(() => {});

    api.get("/alerts?resolved=false&limit=10")
      .then((res) => { if (res && res.length) setAlerts(res); })
      .catch(() => {});

    api.get("/analytics/top-products")
      .then((res) => { if (res && res.length) setTopProducts(res); })
      .catch(() => {});

    setTimeout(() => setIsRefreshing(false), 800);
  };

  useEffect(() => {
    loadData();
    const poll = setInterval(loadData, 5000);

    // Format current time like: "Fri 10 Jul 2026, 09:52 IST"
    const updateTime = () => {
      const now = new Date();
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      const dayName = weekdays[now.getDay()];
      const day = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      
      setCurrentTime(`${dayName} ${day} ${monthName} ${year}, ${hours}:${minutes} IST`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    return () => {
      clearInterval(poll);
      clearInterval(timer);
    };
  }, []);

  const totalMovementsToday = movements.length;
  const outCount = movements.filter(m => m.action.toUpperCase().includes("OUT")).length;
  const inCount = movements.filter(m => m.action.toUpperCase().includes("IN")).length;
  const transCount = movements.filter(m => m.action.toUpperCase().includes("TRANSFER") || m.action.toUpperCase().includes("MOVE")).length;

  // Match cell renderer
  const renderMatch = (m) => {
    let rfid = "✓";
    let qr = "✓";
    let cctv = "✓";
    let rfidTone = "ok";
    let qrTone = "ok";
    let cctvTone = "ok";

    if (m.source === "manual") {
      rfid = "✗"; rfidTone = "no";
      qr = "✗"; qrTone = "no";
      cctv = "✗"; cctvTone = "no";
    } else if (m.employee_name.toLowerCase().includes("unresolved") || !m.emp_id) {
      rfid = "✗"; rfidTone = "no";
      qr = "✓"; qrTone = "ok";
      cctv = "⚠"; cctvTone = "warn";
    } else if (m.source === "vision") {
      rfid = "✗"; rfidTone = "no";
      qr = "✓"; qrTone = "ok";
      cctv = "✓"; cctvTone = "ok";
    } else if (m.source === "rfid") {
      rfid = "✓"; rfidTone = "ok";
      qr = "✗"; qrTone = "no";
      cctv = "✗"; cctvTone = "no";
    }
    
    return (
      <div className="flex gap-1 flex-wrap">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${
          rfidTone === "ok" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
        }`}>RFID {rfid}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${
          qrTone === "ok" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
        }`}>QR {qr}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${
          cctvTone === "ok" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : cctvTone === "warn" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-red-50 text-red-600 border-red-200"
        }`}>CCTV {cctv}</span>
      </div>
    );
  };

  const handleExport = () => {
    alert("Snapshot exported successfully!");
  };

  const maxTopCount = Math.max(1, ...topProducts.map(p => p.count));

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 -mb-2">
        <Link to="/" className="hover:underline text-slate-400">Home</Link>
        <span className="text-slate-300">/</span>
        <span>Overview</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">Dashboard</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">Dashboard</h1>
          <div className="text-sm text-slate-400 mt-2">
            Live warehouse overview · WisRight · {currentTime}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft"
          >
            Export snapshot
          </button>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Products</div>
          <div className="text-3xl font-bold text-slate-900 mt-2 leading-none">{totalProducts}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-2">▲ 3 added this week</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Employees</div>
          <div className="text-3xl font-bold text-slate-900 mt-2 leading-none">
            {currentEntries.length} <span className="text-sm text-slate-400 font-normal">active</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">of {workers.length} registered</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Movements Today</div>
          <div className="text-3xl font-bold text-slate-900 mt-2 leading-none">{totalMovementsToday}</div>
          <div className="text-[11px] text-slate-400 mt-2">
            {outCount} OUT · {inCount} IN · {transCount} Transfer
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Low-Stock (&lt;50)</div>
          <div className="text-3xl font-bold text-amber-500 mt-2 leading-none">{lowStock.length}</div>
          <div className="text-[11px] text-red-500 font-medium mt-2">▼ needs reorder</div>
        </div>
      </div>

      {/* Room Occupancy Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-xl bg-white overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200 shadow-soft">
        <div className="p-4">
          <div className="text-sm font-bold text-primary">Room 1</div>
          <div className="text-xs text-slate-400 mt-1 truncate">
            {currentEntries.find(e => e.room === "Room 1")
              ? `${currentEntries.find(e => e.room === "Room 1").employee_name} · in since ${currentEntries.find(e => e.room === "Room 1").entry_time}`
              : "Empty"}
          </div>
        </div>
        <div className="p-4">
          <div className="text-sm font-bold text-primary">Room 2</div>
          <div className="text-xs text-slate-400 mt-1 truncate">
            {currentEntries.find(e => e.room === "Room 2")
              ? `${currentEntries.find(e => e.room === "Room 2").employee_name} · in since ${currentEntries.find(e => e.room === "Room 2").entry_time}`
              : "Empty"}
          </div>
        </div>
        <div className="p-4">
          <div className="text-sm font-bold text-slate-400">Room 3</div>
          <div className="text-xs text-slate-400 mt-1 truncate">
            {currentEntries.find(e => e.room === "Room 3")
              ? `${currentEntries.find(e => e.room === "Room 3").employee_name} · in since ${currentEntries.find(e => e.room === "Room 3").entry_time}`
              : "Empty · reader offline"}
          </div>
        </div>
        <div className="p-4 bg-red-50/20">
          <div className="text-sm font-bold text-red-500">
            {alerts.filter(a => a.severity === "critical").length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Unknown-person alert (open)</div>
        </div>
      </div>

      {/* Main Grid: Left Wide, Right Narrow */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.70fr_1fr] gap-6 items-start">
        {/* Left Column: Recent Employee Tracking */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">Recent Employee Tracking</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">Cross-checked · RFID · QR · CCTV</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Move</th>
                  <th className="px-5 py-3">From → To</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.slice(0, 5).map((m, idx) => {
                  const isUnresolved = m.employee_name.includes("unresolved");
                  const moveType = m.action.toUpperCase();
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isUnresolved ? "bg-red-50/20" : ""
                      }`}
                    >
                      <td className={`px-5 py-3.5 ${isUnresolved ? "text-red-500 font-medium" : "text-slate-900 font-medium"}`}>
                        {m.employee_name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {m.product_name} <span className="font-mono text-xs text-slate-400 block sm:inline sm:ml-1">({m.product_id})</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          moveType.includes("OUT")
                            ? "bg-red-100 text-red-600"
                            : moveType.includes("IN")
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-blue-100 text-blue-600"
                        }`}>
                          {m.action} ×{m.quantity || 1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {moveType.includes("OUT")
                          ? `Room ${m.room} · ${m.rack} → Dispatch`
                          : moveType.includes("IN")
                          ? `Inbound → Room ${m.room} · ${m.rack}`
                          : `Room ${m.room} · ${m.rack} → Room 1 · D`}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                        {m.entry_time}
                      </td>
                      <td className="px-5 py-3.5">
                        {renderMatch(m)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Showing {Math.min(5, movements.length)} of {movements.length} today</span>
            <div className="flex gap-1">
              <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center bg-primary text-white font-medium">1</button>
              <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">2</button>
              <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">›</button>
            </div>
          </div>
        </div>

        {/* Right Column: Alerts & Low-Stock */}
        <div className="flex flex-col gap-6">
          {/* Low-Stock Alerts */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-soft">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">Low-Stock Alerts</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-200">&lt; 50 units</span>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {lowStock.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-b-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{item.name || item.product_name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.product_id} · Room {item.room} · {item.rack}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.current_stock < 15 ? "bg-red-100 text-red-600 animate-pulse" : "bg-amber-100 text-amber-600"
                  }`}>
                    {item.current_stock} left
                  </span>
                </div>
              ))}
              <Link to="/products" className="inline-flex self-start text-xs font-semibold text-primary hover:underline mt-2">
                View all {lowStock.length} →
              </Link>
            </div>
          </div>

          {/* Unknown-Person Alert */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-soft">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">Unknown-Person Alert</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-600 rounded border border-red-200">● Open</span>
            </div>
            <div className="p-5">
              {alerts.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="p-3 bg-red-50/30 border border-red-100 rounded-lg text-xs text-red-900 leading-relaxed flex gap-2">
                    <span className="shrink-0">🎥</span>
                    <div>
                      {alerts[0].message}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/live" className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded transition-colors flex items-center gap-1">
                      <Eye size={12} /> View camera
                    </Link>
                    <Link to="/verification" className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-medium rounded transition-colors flex items-center gap-1">
                      <CheckCircle2 size={12} /> Reconcile
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center">
                  No active unknown-person alerts.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: High Material-Out Products (Today) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-soft">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">High Material-Out Products (Today)</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">Top movers out</span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            {/* CSS Bar Chart */}
            <div className="flex items-end gap-3 h-[140px] pt-2 border-b border-slate-200 pb-1">
              {topProducts.slice(0, 5).map((p, idx) => {
                const heightPercent = maxTopCount > 0 ? (p.count / maxTopCount) * 100 : 0;
                const shortLabel = p.product.split(" ")[0];
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
                    <div
                      className={`w-full max-w-[42px] rounded-t transition-all duration-500 ${
                        idx < 2 ? "bg-primary opacity-85" : "bg-indigo-300"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[10px] text-slate-400 truncate max-w-full font-medium">{shortLabel}</span>
                  </div>
                );
              })}
              {topProducts.length === 0 && (
                <div className="w-full text-center text-xs text-slate-400 pb-12">No activity data yet today.</div>
              )}
            </div>

            {/* List */}
            <div className="flex flex-col gap-3">
              {topProducts.slice(0, 4).map((p, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0">
                  <span className="text-sm font-medium text-slate-700 truncate max-w-[70%]">{p.product}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-600 rounded border border-red-100">
                    {p.count} out
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-slate-400 mt-2 text-center text-[11px]">
        Static mockup fallback loaded when database connection is inactive · Not a real application.
      </div>
    </div>
  );
}
