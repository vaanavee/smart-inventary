import { useEffect, useMemo, useState } from "react";
import { Search, Download, Plus, Users, Cpu } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";

const DEPT_TONE = {
  Warehouse: "primary",
  Dispatch: "info",
};

const TABS = [
  { id: "directory", label: "Team Directory", icon: Users },
  { id: "device", label: "Device Admin", icon: Cpu },
];

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [tab, setTab] = useState("directory");
  const [deviceIp, setDeviceIp] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState("offline");

  useEffect(() => {
    api.get("/workers").then(setWorkers).catch(() => {});

    const fetchStatus = () => {
      fetch("/monitor-api/rfid/device-status")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.devices && data.devices["Entrance Unit"]) {
            const dev = data.devices["Entrance Unit"];
            setDeviceIp(dev.ip);
            setDeviceStatus(dev.status.toLowerCase());
          }
        })
        .catch((err) => console.error("Error fetching device status:", err));
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const departments = useMemo(() => ["", ...new Set(workers.map((w) => w.department))], [workers]);

  const filtered = useMemo(() => {
    let rows = workers;
    if (department) rows = rows.filter((w) => w.department === department);
    if (query) rows = rows.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()));
    return rows;
  }, [workers, query, department]);

  const exportCsv = () => {
    const rows = [["ID", "Name", "Department"], ...filtered.map((w) => [w.id, w.name, w.department])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Workers"
        subtitle={tab === "directory" ? `${filtered.length} team members` : "Device Administration Portal"}
        actions={
          tab === "directory" ? (
            <>
              <button onClick={exportCsv} className="btn-secondary ripple flex items-center gap-2 !py-2 !px-4 text-sm">
                <Download size={16} /> Export
              </button>
              <button className="btn-primary ripple flex items-center gap-2 !py-2 !px-4 text-sm">
                <Plus size={16} /> Add Worker
              </button>
            </>
          ) : null
        }
      />

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

      {tab === "directory" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workers…"
                className="input-field pl-10"
              />
            </div>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input-field w-auto">
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d || "All Departments"}
                </option>
              ))}
            </select>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-hairline/[0.05]">
                  <th className="p-4 pb-3 font-medium">Worker</th>
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Department</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} className="border-b border-hairline/[0.04] last:border-0 hover:bg-primary/[0.03] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-semibold">
                          {initials(w.name)}
                        </div>
                        <span className="font-medium text-ink">{w.name}</span>
                      </div>
                    </td>
                    <td className="text-muted">#{w.id}</td>
                    <td>
                      <Badge tone={DEPT_TONE[w.department] || "neutral"}>{w.department}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card p-0 overflow-hidden h-[600px] border border-hairline/[0.06] rounded-2xl bg-black/5">
          {deviceIp && deviceStatus === "online" ? (
            <iframe
              src={`http://${deviceIp}/`}
              title="Device Administration Console"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6 bg-surface">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 animate-pulse">
                <Cpu size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink">Entrance Unit Offline</h3>
                <p className="text-muted text-sm max-w-md mt-1">
                  The dashboard is waiting for the physical Entrance Unit ESP32 to connect to the network and check in.
                </p>
              </div>
              {deviceIp ? (
                <div className="text-xs text-muted mt-2">
                  Last known IP: <span className="font-mono bg-hairline/[0.1] px-1.5 py-0.5 rounded">{deviceIp}</span>
                  <a
                    href={`http://${deviceIp}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-primary hover:underline font-medium"
                  >
                    Force Open Console
                  </a>
                </div>
              ) : (
                <div className="text-xs text-muted mt-2">
                  Searching network for device...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
