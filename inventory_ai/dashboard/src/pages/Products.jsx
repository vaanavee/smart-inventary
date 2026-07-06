import { useEffect, useState } from "react";
import { Package, Eye } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { api } from "../api/client.js";

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

  useEffect(() => {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    api.get(`/products${query}`).then(setProducts).catch(() => {});
  }, [category]);

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
