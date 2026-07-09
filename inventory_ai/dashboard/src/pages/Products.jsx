import { useEffect, useMemo, useState } from "react";
import { Package, ScanLine, Boxes } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { monitorApi } from "../api/monitorClient.js";

const ROOM_TONE = {
  "Room 1": "primary",
  "Room 2": "info",
  "Room 3": "violet",
};

const ROOMS = ["Room 1", "Room 2", "Room 3"];
const RACKS = ["A", "B", "C", "D", "E"];

const TABS = [
  { id: "directory", label: "Product Directory", icon: Package },
  { id: "stock", label: "Stock Overview", icon: Boxes },
  { id: "scans", label: "Recent Rack Taps", icon: ScanLine },
];

export default function Products() {
  const [tab, setTab] = useState("directory");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        subtitle={
          tab === "directory"
            ? "Canonical product catalog and inventory details"
            : tab === "stock"
            ? "Stock level metrics, warnings, and room/rack overview"
            : "Audit log of recent RFID rack taps"
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

      {tab === "directory" && <ProductDirectoryTab />}
      {tab === "stock" && <StockOverviewTab />}
      {tab === "scans" && <RecentRackTapsTab />}
    </div>
  );
}

function ProductDirectoryTab() {
  const [products, setProducts] = useState([]);
  const [room, setRoom] = useState("");

  useEffect(() => {
    const query = room ? `?room=${encodeURIComponent(room)}` : "";
    monitorApi.get(`/products${query}`).then(setProducts).catch(() => {});
  }, [room]);

  const rooms = ["", "Room 1", "Room 2", "Room 3"];
  const maxQty = useMemo(() => Math.max(1, ...products.map((p) => p.qty)), [products]);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex justify-end">
        <select value={room} onChange={(e) => setRoom(e.target.value)} className="input-field w-auto">
          {rooms.map((r) => (
            <option key={r} value={r}>
              {r || "All Rooms"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger">
        {products.map((p) => (
          <div key={p.product_id} className="card card-hover p-5 flex flex-col gap-4 group">
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-primary/[0.08] flex items-center justify-center">
                <Package size={26} className="text-primary" strokeWidth={1.5} />
              </div>
              <Badge tone={ROOM_TONE[p.room] || "neutral"}>{p.room}</Badge>
            </div>

            <div>
              <p className="font-semibold text-ink truncate">{p.name}</p>
              <p className="text-xs text-muted mt-0.5">{p.product_id}</p>
            </div>

            <div className="text-xs text-muted flex items-center gap-3">
              <span>Rack {p.rack}</span>
              {p.expiry_date && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted/50" />
                  <span>Expires {p.expiry_date}</span>
                </>
              )}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted">Stock</span>
                <span className="text-ink font-medium">
                  {p.qty} {p.unit}
                </span>
              </div>
              <ProgressBar value={p.qty} max={maxQty} tone={p.qty < 50 ? "warning" : "primary"} />
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="text-sm text-muted">No products match this filter.</p>}
      </div>
    </div>
  );
}

function StockOverviewTab() {
  const [overview, setOverview] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refreshOverview = () => monitorApi.get("/products/overview").then(setOverview).catch(() => {});
    refreshOverview();
    const poll = setInterval(refreshOverview, 5000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    monitorApi.get("/products")
      .then(setCatalog)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalProducts = catalog.length;
  const totalQty = catalog.reduce((sum, p) => sum + p.qty, 0);
  const lowStock = catalog.filter((p) => p.qty < 50);
  const outOfStock = catalog.filter((p) => p.qty === 0);
  const maxQty = Math.max(1, ...catalog.map((p) => p.qty));

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card p-5">
          <p className="text-xs text-muted mb-1">Total Products</p>
          <p className="text-2xl font-semibold text-ink">{totalProducts}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-muted mb-1">Total Units</p>
          <p className="text-2xl font-semibold text-ink">{totalQty}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-muted mb-1">Low Stock (&lt;50 units)</p>
          <p className="text-2xl font-semibold text-warning">{lowStock.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-muted mb-1">Out of Stock</p>
          <p className="text-2xl font-semibold text-danger">{outOfStock.length}</p>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-ink mb-4">Stock by Room / Rack</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {overview.map((room) => (
            <div key={room.room}>
              <p className="text-sm font-medium text-ink mb-3">{room.room}</p>
              <ul className="flex flex-col gap-2">
                {room.racks.map((r) => (
                  <li key={r.rack} className="text-xs text-muted flex justify-between">
                    <span>Rack {r.rack}</span>
                    <span>{r.totalQty} units / {r.productCount} SKUs</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6 overflow-x-auto">
        <h3 className="font-semibold text-ink mb-4">All Products</h3>
        {loading ? (
          <p className="text-sm text-muted">Loading catalog…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-hairline/[0.05]">
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Location</th>
                <th className="pb-3 font-medium">Quantity</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((p) => (
                <tr key={p.product_id} className="border-b border-hairline/[0.04] last:border-0">
                  <td className="py-3">
                    <p className="text-ink font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{p.product_id}</p>
                  </td>
                  <td className="py-3 text-muted">{p.room} / {p.rack}</td>
                  <td className="py-3 w-48">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={p.qty} max={maxQty} tone={p.qty < 50 ? "warning" : "primary"} />
                      <span className="text-xs text-muted whitespace-nowrap">{p.qty} {p.unit}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    {p.qty === 0 ? (
                      <Badge tone="danger">Out of Stock</Badge>
                    ) : p.qty < 50 ? (
                      <Badge tone="warning">Low Stock</Badge>
                    ) : (
                      <Badge tone="success">Healthy</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RecentRackTapsTab() {
  const [rackScans, setRackScans] = useState([]);

  useEffect(() => {
    const refresh = () => monitorApi.get("/rfid/rack-scans?limit=10").then(setRackScans).catch(() => {});
    refresh();
    const poll = setInterval(refresh, 2000);
    return () => clearInterval(poll);
  }, []);

  return (
    <div className="card p-6 animate-fadeIn">
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
  );
}
