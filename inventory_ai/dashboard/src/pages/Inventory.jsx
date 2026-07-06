import { useEffect, useMemo, useState } from "react";
import { Search, Download, Plus, ArrowUpDown } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { api } from "../api/client.js";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);

  useEffect(() => {
    api.get("/inventory").then(setItems).catch(() => {});
  }, []);

  const categories = useMemo(() => ["", ...new Set(items.map((i) => i.category))], [items]);

  const filtered = useMemo(() => {
    let rows = items;
    if (category) rows = rows.filter((r) => r.category === category);
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number") return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }, [items, query, category, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => -d);
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const exportCsv = () => {
    const header = ["Name", "SKU", "Category", "Rack", "Box", "Stock", "Min", "Max"];
    const rows = filtered.map((p) => [p.name, p.sku, p.category, p.rack, p.box_number, p.current_stock, p.minimum_stock, p.maximum_stock]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const Th = ({ label, sortableKey }) => (
    <th className="pb-3 font-medium select-none">
      <button
        onClick={() => sortableKey && toggleSort(sortableKey)}
        className={`flex items-center gap-1 ${sortableKey ? "cursor-pointer hover:text-ink" : ""}`}
      >
        {label}
        {sortableKey && <ArrowUpDown size={12} />}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        subtitle={`${filtered.length} products tracked across all racks`}
        actions={
          <>
            <button onClick={exportCsv} className="btn-secondary ripple flex items-center gap-2 !py-2 !px-4 text-sm">
              <Download size={16} /> Export Excel
            </button>
            <button className="btn-primary ripple flex items-center gap-2 !py-2 !px-4 text-sm">
              <Plus size={16} /> Add Product
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
            placeholder="Search by name or SKU…"
            className="input-field pl-10"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field w-auto">
          {categories.map((c) => (
            <option key={c} value={c}>
              {c || "All Categories"}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-black/[0.05]">
              <th className="p-4 pb-3 font-medium">
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-ink">
                  Name <ArrowUpDown size={12} />
                </button>
              </th>
              <Th label="SKU" />
              <Th label="Category" />
              <Th label="Rack / Box" />
              <Th label="Stock Level" />
              <Th label="Status" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const low = p.current_stock <= p.minimum_stock;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-black/[0.04] last:border-0 transition-colors hover:bg-primary/[0.03] ${
                    low ? "bg-primary/[0.04]" : ""
                  }`}
                >
                  <td className="p-4 font-medium text-ink">{p.name}</td>
                  <td className="text-muted">{p.sku}</td>
                  <td className="text-muted">{p.category}</td>
                  <td className="text-muted">
                    R{p.rack} / {p.box_number}
                  </td>
                  <td className="w-48">
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={p.current_stock}
                        max={p.maximum_stock}
                        tone={low ? "warning" : "primary"}
                      />
                      <span className="text-xs text-muted whitespace-nowrap">
                        {p.current_stock}/{p.maximum_stock}
                      </span>
                    </div>
                  </td>
                  <td>
                    {low ? <Badge tone="warning">Low Stock</Badge> : <Badge tone="success">Healthy</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
