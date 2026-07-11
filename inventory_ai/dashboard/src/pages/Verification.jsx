import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ScanLine, CheckCircle2, ClipboardPlus, RefreshCw, Eye } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";
import { monitorApi } from "../api/monitorClient.js";

const ROOMS = ["Room 1", "Room 2", "Room 3"];
const RACKS = ["A", "B", "C", "D", "E"];
const ACTIONS = ["Stock In", "Stock Out", "Transfer"];

const TABS = [
  { id: "reconciliation", label: "Attendance Match", icon: ScanLine },
  { id: "verify", label: "Verify Box", icon: CheckCircle2 },
  { id: "manual", label: "Manual Entry", icon: ClipboardPlus },
];

export default function Verification() {
  const [tab, setTab] = useState("reconciliation");

  return (
    <div className="flex flex-col gap-6 font-display">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 -mb-2">
        <Link to="/" className="hover:underline text-slate-400">Home</Link>
        <span className="text-slate-300">/</span>
        <span>Monitoring</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">Attendance Match</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">
            {tab === "reconciliation" ? "Attendance Match / Reconciliation" : tab === "verify" ? "Verify Box" : "Manual Entry"}
          </h1>
          <div className="text-sm text-slate-400 mt-2">
            {tab === "reconciliation" && "Every movement checked: RFID door entry vs QR scan vs CCTV sighting"}
            {tab === "verify" && "Scan a box to verify product and quantity against expected inventory"}
            {tab === "manual" && "Log new stock being sent to a room/rack without scanning"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100 mb-5 overflow-x-auto w-full">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 bg-transparent transition-all ${
                active ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "reconciliation" && <AttendanceReconciliationTab />}
      {tab === "verify" && <VerifyBoxTab />}
      {tab === "manual" && <ManualEntryTab />}
    </div>
  );
}

// NEW TAB: ATTENDANCE RECONCILIATION LOG
function AttendanceReconciliationTab() {
  const [movements, setMovements] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [dateFilter, setDateFilter] = useState("2026-07-10");

  const loadData = () => {
    // Core default mockup logs
    const defaultLogs = [
      { ref: "MOV-004821", employee_name: "Vishali Nair", product_name: "Drill", action: "OUT", quantity: 3, room: "Room 2", rfid: "✓ 09:51", qr: "✓ 09:14", cctv: "ok", verdict: "Verified" },
      { ref: "MOV-004822", employee_name: "Arjun Das", product_name: "Grinder", action: "Transfer", quantity: 2, room: "Room 2", rfid: "✓ 09:40", qr: "✓ 09:41", cctv: "ok", verdict: "Verified" },
      { ref: "MOV-004823", employee_name: "— unresolved —", product_name: "Copper Wire", action: "OUT", quantity: 5, room: "Room 2", rfid: "✗ none", qr: "✓ 09:47", cctv: "warn", verdict: "Alert" },
      { ref: "MOV-004819", employee_name: "Vaanavee R.", product_name: "LED Panel", action: "OUT", quantity: 6, room: "Room 3", rfid: "✓ 08:57", qr: "✓ 08:58", cctv: "no", verdict: "Review" },
      { ref: "MOV-004815", employee_name: "Suraj Menon", product_name: "Impact Driver", action: "OUT", quantity: 2, room: "Room 2", rfid: "✓ 08:32", qr: "✗ none", cctv: "ok", verdict: "Review" },
      { ref: "MOV-004812", employee_name: "Vishal Kumar", product_name: "Hex Bolts", action: "IN", quantity: 20, room: "Room 1", rfid: "✓ 09:04", qr: "✓ 09:05", cctv: "ok", verdict: "Verified" }
    ];

    // Load any user scans created in QR Scanner
    const stored = localStorage.getItem("local-movements");
    const localMoves = stored ? JSON.parse(stored) : [];

    // Combine local additions
    const combined = [];
    localMoves.forEach((lm) => {
      combined.push({
        ref: lm.ref,
        employee_name: lm.employee_name,
        product_name: lm.product_name,
        action: lm.action,
        quantity: lm.quantity,
        room: lm.room,
        rfid: `✓ ${lm.rfid_time}`,
        qr: `✓ ${lm.qr_time}`,
        cctv: "ok",
        verdict: "Verified"
      });
    });

    defaultLogs.forEach((item) => {
      combined.push(item);
    });

    setMovements(combined);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered movements list
  const filtered = useMemo(() => {
    return movements.filter((m) => {
      const matchesStatus =
        statusFilter === "All" || m.verdict === statusFilter;
      const matchesRoom =
        roomFilter === "All rooms" || m.room === roomFilter;
      return matchesStatus && matchesRoom;
    });
  }, [movements, statusFilter, roomFilter]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = movements.length;
    const verified = movements.filter(m => m.verdict === "Verified").length;
    const review = movements.filter(m => m.verdict === "Review").length;
    const alert = movements.filter(m => m.verdict === "Alert").length;
    return { total, verified, review, alert };
  }, [movements]);

  // Resolve warning/alerts handlers
  const handleResolveAlert = (ref) => {
    const updated = movements.map((m) => {
      if (m.ref === ref) {
        return {
          ...m,
          employee_name: "Vishali Nair",
          rfid: "✓ 09:46",
          cctv: "ok",
          verdict: "Verified"
        };
      }
      return m;
    });
    setMovements(updated);
    alert(`Alert resolved! Transaction ${ref} is now Verified.`);
  };

  const handleAcceptReview = (ref) => {
    const updated = movements.map((m) => {
      if (m.ref === ref) {
        return {
          ...m,
          verdict: "Verified"
        };
      }
      return m;
    });
    setMovements(updated);
    alert(`Accepted review! Transaction ${ref} is now Verified.`);
  };

  // CSV Exporter
  const handleExport = () => {
    const headers = "Ref,Employee,Product / Move,Room,RFID,QR,CCTV,Verdict\n";
    const rows = movements.map(m => `"${m.ref}","${m.employee_name}","${m.product_name} · ${m.action} ×${m.quantity}","${m.room}","${m.rfid}","${m.qr}","${m.cctv === "ok" ? "OK" : m.cctv}","${m.verdict}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation_log_${dateFilter}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Movements today</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{stats.total}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Verified (all ✓)</div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">{stats.verified}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Needs review</div>
          <div className="text-3xl font-bold text-amber-500 mt-2">{stats.review}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Alert</div>
          <div className="text-3xl font-bold text-red-500 mt-2">{stats.alert}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {["All", "Verified", "Review", "Alert"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                statusFilter === status
                  ? "bg-primary-50 border-primary text-primary font-semibold"
                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <span className="flex-grow"></span>

        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className="input-field w-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
        >
          <option value="All rooms">All rooms</option>
          <option value="Room 1">Room 1</option>
          <option value="Room 2">Room 2</option>
          <option value="Room 3">Room 3</option>
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="input-field w-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
        />

        <button
          onClick={handleExport}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Reconciliation Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">Reconciliation Log</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
            Today · 10 Jul
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                <th className="px-5 py-3">Ref</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Product / Move</th>
                <th className="px-5 py-3">Room</th>
                <th className="px-5 py-3">RFID</th>
                <th className="px-5 py-3">QR</th>
                <th className="px-5 py-3">CCTV</th>
                <th className="px-5 py-3">Verdict</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr
                  key={m.ref}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    m.verdict === "Alert"
                      ? "bg-red-50/30"
                      : m.verdict === "Review"
                      ? "bg-amber-50/30"
                      : ""
                  }`}
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-900">{m.ref}</td>
                  <td className="px-5 py-3.5 text-slate-900 font-medium">{m.employee_name}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs font-medium">
                    {m.product_name} · {m.action} ×{m.quantity}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{m.room}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full leading-none ${
                      m.rfid.includes("✓")
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-red-50 text-red-600 border-red-100"
                    }`}>
                      {m.rfid}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full leading-none ${
                      m.qr.includes("✓")
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-red-50 text-red-600 border-red-100"
                    }`}>
                      {m.qr}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full leading-none ${
                      m.cctv === "ok"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : m.cctv === "no" || m.cctv === "offline"
                        ? "bg-red-50 text-red-600 border-red-100"
                        : "bg-amber-50 text-amber-600 border-amber-100"
                    }`}>
                      {m.cctv === "ok" ? "✓" : m.cctv === "no" || m.cctv === "offline" ? "✗ offline" : "⚠ unknown"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full leading-none ${
                      m.verdict === "Verified"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : m.verdict === "Review"
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-red-50 text-red-600 border-red-100"
                    }`}>
                      {m.verdict}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {m.verdict === "Alert" ? (
                      <button
                        onClick={() => handleResolveAlert(m.ref)}
                        className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold rounded transition-colors"
                      >
                        Resolve
                      </button>
                    ) : m.verdict === "Review" ? (
                      <button
                        onClick={() => handleAcceptReview(m.ref)}
                        className="px-3 py-1.5 border border-amber-200 hover:bg-amber-50 text-amber-600 text-xs font-semibold rounded transition-colors"
                      >
                        Accept
                      </button>
                    ) : (
                      <button className="px-2 py-1 text-xs font-semibold text-slate-400 hover:underline bg-transparent border-0 cursor-default">
                        Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-5 py-8 text-center text-xs text-slate-400">
                    No transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filtered.length} of {movements.length} logs</span>
          <div className="flex gap-1">
            <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center bg-primary text-white font-medium">1</button>
            <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">2</button>
            <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ORIGINAL TABS (re-themed for consistency)
function VerifyBoxTab() {
  const [boxId, setBoxId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workers, setWorkers] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get("/workers").then(setWorkers).catch(() => {});
    const refreshRecent = () => api.get("/history?limit=6").then(setRecent).catch(() => {});
    refreshRecent();
    const poll = setInterval(refreshRecent, 5000);
    return () => clearInterval(poll);
  }, []);

  const runVerification = async () => {
    if (!boxId || !workerId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.post("/verify/run", { box_id: boxId, worker_id: Number(workerId) });
      setResult(data);
      api.get("/history?limit=6").then(setRecent).catch(() => {});
    } catch (e) {
      setError(e.message || "Verification run failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft flex flex-col gap-4">
        <h3 className="font-semibold text-slate-800 text-sm">Visual box verification</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <label className="text-xs font-semibold text-slate-700">
            Select Worker
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="input-field mt-1.5">
              <option value="">Select worker...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (#{w.id})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-700">
            Box ID
            <input
              type="text"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              placeholder="e.g. BOX-001"
              className="input-field mt-1.5"
            />
          </label>
        </div>

        <button
          onClick={runVerification}
          disabled={!boxId || !workerId || loading}
          className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-all shadow-soft flex items-center justify-center gap-2 mt-2"
        >
          {loading ? "Running AI comparison..." : "Compare & Verify"}
        </button>

        {error && <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg font-medium">{error}</div>}

        {result && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-800 text-sm">AI Verification Verdict</span>
              <Badge tone={result.verification_status === "VERIFIED" ? "success" : "danger"}>
                {result.verification_status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-slate-400">Expected SKU count:</span>
              <span className="font-semibold text-slate-800 text-right">{result.expected_quantity}</span>
              <span className="text-slate-400">Detected box count:</span>
              <span className="font-semibold text-slate-800 text-right">{result.detected_quantity}</span>
              <span className="text-slate-400">Model Confidence score:</span>
              <span className="font-semibold text-slate-800 text-right">{(result.confidence_score * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent scans list */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
        <h3 className="font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-3">Recent Scans</h3>
        <ul className="flex flex-col gap-3">
          {recent.map((r, i) => (
            <li key={i} className="text-xs flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800">Box Verification #{r.id}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full leading-none uppercase ${
                  r.verification_status === "VERIFIED"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : "bg-red-50 text-red-600 border-red-100"
                }`}>
                  {r.verification_status}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Score: {(r.confidence_score * 100).toFixed(0)}% · {new Date(r.timestamp).toLocaleTimeString()}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ManualEntryTab() {
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [empId, setEmpId] = useState("");
  const [productId, setProductId] = useState("");
  const [room, setRoom] = useState("");
  const [rack, setRack] = useState("");
  const [action, setAction] = useState("Stock In");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);

  const loadRecent = () => api.get("/history/manual?limit=5").then(setRecent).catch(() => {});

  useEffect(() => {
    monitorApi.get("/employees").then(setEmployees).catch(() => {});
    monitorApi.get("/products").then(setProducts).catch(() => {});
    loadRecent();
  }, []);

  const submit = async () => {
    if (!empId || !productId || !room || !rack || !quantity) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post("/verify/manual", {
        emp_id: empId,
        product_id: productId,
        room,
        rack,
        action,
        qty: Number(quantity),
        notes,
      });
      setSuccess("Manual stock entry successfully logged.");
      setEmpId("");
      setProductId("");
      setRoom("");
      setRack("");
      setQuantity("");
      setNotes("");
      loadRecent();
    } catch (e) {
      setError(e.message || "Manual log submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = empId && productId && room && rack && quantity && !submitting;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft flex flex-col gap-4">
        <h3 className="font-semibold text-slate-800 text-sm">New Stock Placement</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs font-semibold text-slate-700">
            Logged By (Employee)
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="input-field mt-1.5 bg-white">
              <option value="">Select employee...</option>
              {employees.map((e) => (
                <option key={e.emp_id} value={e.emp_id}>
                  {e.name} ({e.emp_id})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-700">
            Product
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="input-field mt-1.5 bg-white">
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} ({p.product_id})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs font-semibold text-slate-700">
            Floor / Room
            <select value={room} onChange={(e) => setRoom(e.target.value)} className="input-field mt-1.5 bg-white">
              <option value="">Select room...</option>
              {ROOMS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-700">
            Rack
            <select value={rack} onChange={(e) => setRack(e.target.value)} className="input-field mt-1.5 bg-white">
              <option value="">Select rack...</option>
              {RACKS.map((r) => (
                <option key={r} value={r}>Rack {r}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs font-semibold text-slate-700">
            Action
            <select value={action} onChange={(e) => setAction(e.target.value)} className="input-field mt-1.5 bg-white">
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-700">
            Quantity
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 20"
              className="input-field mt-1.5"
            />
          </label>
        </div>

        <label className="text-xs font-semibold text-slate-700">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. New shipment from supplier"
            rows={3}
            className="input-field mt-1.5 resize-none bg-white"
          />
        </label>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-all shadow-soft flex items-center justify-center gap-2 mt-2"
        >
          {submitting ? "Logging..." : "Log Entry"}
        </button>

        {error && <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg font-medium">{error}</div>}
        {success && <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-lg font-medium">{success}</div>}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
        <h3 className="font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-3">Recent Manual Entries</h3>
        <ul className="flex flex-col gap-3">
          {recent.map((r, i) => (
            <li key={i} className="text-xs flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800">{r.product_name}</span>
                <span className="text-[9px] font-bold px-2 py-0.5 border border-blue-100 bg-blue-50 text-blue-600 rounded-full leading-none uppercase">{r.action}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {r.room} · Rack {r.rack} · {r.employee_name}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
