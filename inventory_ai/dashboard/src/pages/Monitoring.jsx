import { useEffect, useMemo, useState } from "react";
import { Camera, CameraOff, Power, DoorOpen, Package, Search, AlertCircle, Users, UserX, Gauge, Clock, ArrowRight } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { monitorApi } from "../api/monitorClient.js";

const AI_BASE_URL = "/monitor-ai-api";

const ROOMS = ["Room 1", "Room 2", "Room 3"];
const RACKS = ["A", "B", "C", "D", "E"];

const TABS = [
  { id: "cctv", label: "CCTV Monitoring", icon: Camera },
  { id: "employee", label: "Employee Monitoring", icon: DoorOpen },
  { id: "guidance", label: "Product Guidance", icon: Search },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Monitoring() {
  const [tab, setTab] = useState("cctv");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Monitoring" subtitle="CCTV, employee tracking, stock, and product guidance in one place" />

      <div className="inline-flex flex-wrap rounded-xl bg-hairline/[0.05] p-1 gap-1 w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? "bg-surface-alt text-ink shadow-soft" : "text-muted"
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "cctv" && <CctvTab />}
      {tab === "employee" && <EmployeeTab />}
      {tab === "guidance" && <GuidanceTab />}
    </div>
  );
}

export function CctvTab() {
  const [live, setLive] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [streamKey] = useState(() => Date.now());
  const [powering, setPowering] = useState(false);

  useEffect(() => {
    const refresh = () => {
      fetch(`${AI_BASE_URL}/live`)
        .then((res) => {
          if (!res.ok) throw new Error(`AI service returned ${res.status}`);
          return res.json();
        })
        .then(setLive)
        .catch((e) => setError(e.message));
    };
    refresh();
    const isStarting = powering || (live?.power_on && !live?.camera_connected);
    const poll = setInterval(refresh, isStarting ? 300 : 1000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [powering, live?.power_on, live?.camera_connected]);

  const cameraOnline = !!live?.camera_connected;
  const powerOn = !!live?.power_on;

  async function toggleCamera() {
    setPowering(true);
    setError(null);
    try {
      await fetch(`${AI_BASE_URL}/camera/${powerOn ? "off" : "on"}`, { method: "POST" });
      const res = await fetch(`${AI_BASE_URL}/live`);
      if (res.ok) setLive(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setPowering(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-4 flex items-start gap-3 bg-info/[0.04] border-info/20">
        <AlertCircle size={18} className="text-info shrink-0 mt-0.5" />
        <p className="text-xs text-muted leading-relaxed">
          Identity matching assigns tracked people to active RFID sessions by order of
          appearance (oldest unassigned check-in claims the next new track) — it is not
          biometric face recognition, and works best with one new person entering at a time.
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${powerOn ? (cameraOnline ? "bg-success" : "bg-warning") : "bg-danger"}`} />
          <span className="text-sm text-muted">
            IP Camera {powerOn ? (cameraOnline ? "on" : "starting…") : "off"}
          </span>
        </div>
        <button
          onClick={toggleCamera}
          disabled={powering}
          className={`ripple flex items-center gap-2 text-sm ${powerOn ? "btn-secondary" : "btn-primary"} ${powering ? "opacity-60 cursor-wait" : ""}`}
        >
          <Power size={16} /> {powering ? "…" : powerOn ? "Turn Camera Off" : "Turn Camera On"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card p-4 flex flex-col gap-1">
          <Users size={16} className="text-success" />
          <p className="text-xs text-muted">Employees</p>
          <p className="text-lg font-semibold text-ink">{live?.employee_count ?? "—"}</p>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <UserX size={16} className="text-danger" />
          <p className="text-xs text-muted">Unknown</p>
          <p className="text-lg font-semibold text-ink">{live?.unknown_count ?? "—"}</p>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <Gauge size={16} className="text-primary" />
          <p className="text-xs text-muted">FPS</p>
          <p className="text-lg font-semibold text-ink">{live?.fps ?? "—"}</p>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <Camera size={16} className={cameraOnline ? "text-success" : "text-danger"} />
          <p className="text-xs text-muted">Camera</p>
          <p className={`text-lg font-semibold ${cameraOnline ? "text-success" : "text-danger"}`}>
            {cameraOnline ? "Online" : "Offline"}
          </p>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <Clock size={16} className="text-muted" />
          <p className="text-xs text-muted">Time</p>
          <p className="text-lg font-semibold text-ink">{now.toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {powerOn ? (
          <img
            key={streamKey}
            src={`${AI_BASE_URL}/stream`}
            alt={`Live feed — ${live?.room ?? "camera"}`}
            className="w-full h-auto bg-black block"
          />
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-black/40 text-muted">
            <CameraOff size={40} strokeWidth={1.2} className="text-danger/70" />
            <p className="text-sm">Camera is off — press “Turn Camera On” to start the live feed.</p>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-ink mb-4">Detected People — {live?.room ?? "—"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(live?.tracks ?? []).map((t) => (
            <div key={t.tracker_id} className="rounded-xl border border-hairline/[0.06] p-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{t.employee_name || "Unknown Person"}</span>
                <Badge tone={t.employee_name ? "success" : "danger"}>{t.employee_name ? "Present" : "Unknown"}</Badge>
              </div>
              <p className="text-xs text-muted">Tracking ID: {t.tracker_id}</p>
              {t.entry_time && <p className="text-xs text-muted">Entered: {t.entry_time}</p>}
              <p className="text-xs text-muted">Confidence: {(t.confidence * 100).toFixed(0)}%</p>
              {t.carrying && (
                <span className="mt-1"><Badge tone="warning" dot>Carrying box</Badge></span>
              )}
            </div>
          ))}
          {(!live?.tracks || live.tracks.length === 0) && (
            <p className="text-sm text-muted">No one currently detected in frame.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmployeeTab() {
  const [current, setCurrent] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [history, setHistory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const refreshCurrent = () => monitorApi.get("/room-entries/current").then(setCurrent).catch((e) => setError(e.message));
    refreshCurrent();
    const poll = setInterval(refreshCurrent, 3000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const refreshHistoryAndTransfers = () => {
      monitorApi.get(`/room-entries?date=${date}`).then(setHistory).catch((e) => setError(e.message));
      monitorApi.get(`/transfers?date=${date}`).then(setTransfers).catch(() => {});
    };
    refreshHistoryAndTransfers();
    const poll = setInterval(refreshHistoryAndTransfers, 5000);
    return () => clearInterval(poll);
  }, [date]);

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Currently Inside</h3>
          <Badge tone="info">{current.length} active</Badge>
        </div>
        <ul className="flex flex-col divide-y divide-hairline/[0.05]">
          {current.map((c) => (
            <li key={c.emp_id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <p className="text-ink font-medium">{c.employee_name}</p>
                <p className="text-xs text-muted">{c.emp_id} • {c.rfid_tag}</p>
              </div>
              <div className="text-right">
                <Badge tone="success">{c.room}</Badge>
                <p className="text-xs text-muted mt-1">In since {c.entry_time}</p>
              </div>
            </li>
          ))}
          {current.length === 0 && <li className="py-3 text-sm text-muted">No one is currently inside.</li>}
        </ul>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Entry/Exit History</h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field w-auto"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-hairline/[0.05]">
                <th className="pb-3 font-medium">Employee</th>
                <th className="pb-3 font-medium">Room</th>
                <th className="pb-3 font-medium">Entry</th>
                <th className="pb-3 font-medium">Exit</th>
                <th className="pb-3 font-medium">Duration</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-b border-hairline/[0.04] last:border-0">
                  <td className="py-3 text-ink font-medium">{h.employee_name}</td>
                  <td className="py-3 text-muted">{h.room}</td>
                  <td className="py-3 text-muted">{h.entry_time}</td>
                  <td className="py-3 text-muted">{h.exit_time || "—"}</td>
                  <td className="py-3 text-muted">{h.duration || "—"}</td>
                  <td className="py-3">
                    <Badge tone={h.status === "Completed" ? "success" : "info"}>{h.status}</Badge>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted">
                    No entries for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PackageCheck size={18} className="text-primary" />
            <h3 className="font-semibold text-ink">Box Transfers</h3>
          </div>
          <Badge tone="info">{transfers.length} on {date}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-hairline/[0.05]">
                <th className="pb-3 font-medium">Employee</th>
                <th className="pb-3 font-medium">Movement</th>
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-hairline/[0.04] last:border-0">
                  <td className="py-3 text-ink font-medium">{t.employee_name || "—"}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Badge tone="info">{t.from_room}</Badge>
                      <ArrowRight size={14} className="text-primary" />
                      <Badge tone="success">{t.to_room}</Badge>
                    </span>
                  </td>
                  <td className="py-3 text-muted">{t.product_name || "Unidentified box"}</td>
                  <td className="py-3 text-muted">{t.start_time || t.end_time || "—"}</td>
                  <td className="py-3">
                    <Badge tone={t.source === "vision+qr" ? "success" : "neutral"}>{t.source}</Badge>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No box transfers detected for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function useCatalog() {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const combos = ROOMS.flatMap((room) => RACKS.map((rack) => ({ room, rack })));
    Promise.all(
      combos.map(({ room, rack }) =>
        monitorApi.get(`/products?room=${encodeURIComponent(room)}&rack=${rack}`).catch(() => [])
      )
    )
      .then((results) => setCatalog(results.flat()))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { catalog, loading, error };
}

export function GuidanceTab() {
  const { catalog, loading } = useCatalog();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query) return catalog;
    const q = query.toLowerCase();
    return catalog.filter((p) => p.name.toLowerCase().includes(q) || p.product_id.toLowerCase().includes(q));
  }, [catalog, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product name or ID…"
          className="input-field pl-10"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading catalog…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.slice(0, 30).map((p) => (
            <div key={p.product_id} className="card card-hover p-5 flex flex-col gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary/[0.08] flex items-center justify-center">
                <Package size={22} className="text-primary" strokeWidth={1.5} />
              </div>
              <p className="font-semibold text-ink">{p.name}</p>
              <p className="text-xs text-muted">{p.product_id}</p>
              <div className="text-xs text-muted flex items-center gap-3">
                <span>Room {p.room}</span>
                <span className="w-1 h-1 rounded-full bg-muted/50" />
                <span>Rack {p.rack}</span>
              </div>
              <p className="text-xs text-ink font-medium">
                {p.qty} {p.unit} available
              </p>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted">No products match your search.</p>}
        </div>
      )}
    </div>
  );
}
