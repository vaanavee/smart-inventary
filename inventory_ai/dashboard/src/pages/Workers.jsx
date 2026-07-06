import { useEffect, useMemo, useState } from "react";
import { Search, Download, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";

const DEPT_TONE = {
  Warehouse: "primary",
  Dispatch: "info",
};

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

  useEffect(() => {
    api.get("/workers").then(setWorkers).catch(() => {});
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
        subtitle={`${filtered.length} team members`}
        actions={
          <>
            <button onClick={exportCsv} className="btn-secondary ripple flex items-center gap-2 !py-2 !px-4 text-sm">
              <Download size={16} /> Export
            </button>
            <button className="btn-primary ripple flex items-center gap-2 !py-2 !px-4 text-sm">
              <Plus size={16} /> Add Worker
            </button>
          </>
        }
      />

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
            <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-black/[0.05]">
              <th className="p-4 pb-3 font-medium">Worker</th>
              <th className="pb-3 font-medium">ID</th>
              <th className="pb-3 font-medium">Department</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id} className="border-b border-black/[0.04] last:border-0 hover:bg-primary/[0.03] transition-colors">
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
    </div>
  );
}
