import { useEffect, useState } from "react";
import { Package, Eye, ScanLine } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { api } from "../api/client.js";
import { monitorApi } from "../api/monitorClient.js";

const CATEGORY_TONE = {
  Stationery: "primary",
  Books: "info",
  "Office Supplies": "violet",
  Electronics: "success",
  Accessories: "warning",
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("");
  const [rackScans, setRackScans] = useState([]);

  useEffect(() => {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    api.get(`/products${query}`).then(setProducts).catch(() => {});
  }, [category]);

  useEffect(() => {
    const refresh = () => monitorApi.get("/rfid/rack-scans?limit=10").then(setRackScans).catch(() => {});
    refresh();
    const poll = setInterval(refresh, 2000);
    return () => clearInterval(poll);
  }, []);

  const categories = ["", "Stationery", "Books", "Office Supplies", "Electronics", "Accessories"];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        subtitle={`${products.length} products in catalog`}
        actions={
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field w-auto">
            {categories.map((c) => (
              <option key={c} value={c}>
                {c || "All Categories"}
              </option>
            ))}
          </select>
        }
      />

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ScanLine size={18} className="text-primary" />
            <h3 className="font-semibold text-ink">Recent Rack Taps</h3>
          </div>
          <Badge tone="info">{rackScans.length} recent</Badge>
        </div>
        <ul className="flex flex-col divide-y divide-hairline/[0.05]">
          {rackScans.map((s) => (
            <li key={s.id} className="py-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink font-medium">
                    {s.employee_name} <span className="text-muted font-normal">tapped in</span> {s.room} / Rack {s.rack}
                  </p>
                  <p className="text-xs text-muted">{s.emp_id} • {s.rfid_tag}</p>
                </div>
                <p className="text-xs text-muted whitespace-nowrap">at {s.time}</p>
              </div>
              {s.products.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {s.products.map((p) => (
                    <span key={p.product_id} className="text-xs rounded-full bg-hairline/[0.06] px-3 py-1 text-muted">
                      {p.name} — {p.qty} {p.unit}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">No products recorded at this rack.</p>
              )}
            </li>
          ))}
          {rackScans.length === 0 && <li className="py-3 text-sm text-muted">No rack taps yet.</li>}
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger">
        {products.map((p) => {
          const pct = p.maximum_stock ? (p.current_stock / p.maximum_stock) * 100 : 0;
          return (
            <div key={p.id} className="card card-hover p-5 flex flex-col gap-4 group">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-gradient-primary/[0.08] flex items-center justify-center">
                  <Package size={26} className="text-primary" strokeWidth={1.5} />
                </div>
                <Badge tone={CATEGORY_TONE[p.category] || "neutral"}>{p.category}</Badge>
              </div>

              <div>
                <p className="font-semibold text-ink truncate">{p.name}</p>
                <p className="text-xs text-muted mt-0.5">{p.sku}</p>
              </div>

              <div className="text-xs text-muted flex items-center gap-3">
                <span>Rack {p.rack}</span>
                <span className="w-1 h-1 rounded-full bg-muted/50" />
                <span>Box {p.box_number}</span>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted">Stock</span>
                  <span className="text-ink font-medium">
                    {p.current_stock}/{p.maximum_stock}
                  </span>
                </div>
                <ProgressBar value={p.current_stock} max={p.maximum_stock} tone={pct < 20 ? "warning" : "primary"} />
              </div>

              <button className="btn-secondary ripple flex items-center justify-center gap-2 text-xs !py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Eye size={14} /> Quick View
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
