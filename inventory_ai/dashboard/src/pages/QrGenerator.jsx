import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Package, ArrowRight, Download, Printer, Search } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { encodeProductQR } from "../utils/qrPayload.js";

const CATEGORY_TONE = {
  Stationery: "primary",
  Books: "info",
  "Office Supplies": "violet",
  Electronics: "success",
  Accessories: "warning",
};

const RACKS = Array.from({ length: 7 }, (_, i) => `R${i + 1}`);

export default function QrGenerator() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [moveQty, setMoveQty] = useState(0);
  const [src, setSrc] = useState("");
  const [dst, setDst] = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get("/products").then(setProducts).catch(() => {});
  }, []);

  const product = products.find((p) => p.id === selectedId) || null;

  // When a product is picked, seed the move form from its current values.
  useEffect(() => {
    if (product) {
      setMoveQty(product.current_stock);
      setSrc(product.rack);
      setDst("");
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const rackOptions = useMemo(
    () => Array.from(new Set([...RACKS, product?.rack].filter(Boolean))),
    [product]
  );

  // ts stamps generation time; recomputed when the product/fields change.
  const qrValue = useMemo(() => {
    if (!product) return "";
    return encodeProductQR({
      ...product,
      src,
      dst,
      moveQty: Number(moveQty),
      ts: new Date().toISOString(),
    });
  }, [product, src, dst, moveQty]);

  function downloadPng() {
    if (!canvasRef.current || !product) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${product.name}-${product.sku}.png`.replace(/\s+/g, "_");
    a.click();
  }

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="QR Generator" subtitle="Create product QR codes for stock movement" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* Product picker */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product or SKU…"
              className="input-field !pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                  p.id === selectedId
                    ? "bg-gradient-primary/[0.08] border-primary/40"
                    : "border-hairline/[0.05] hover:bg-hairline/[0.04]"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-primary/[0.08] flex items-center justify-center shrink-0">
                  <Package size={18} className="text-primary" strokeWidth={1.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                  <p className="text-xs text-muted">{p.sku} · {p.current_stock} in stock</p>
                </div>
                <Badge tone={CATEGORY_TONE[p.category] || "neutral"}>{p.category}</Badge>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-sm text-muted px-1 py-6 text-center">No products found.</p>}
          </div>
        </div>

        {/* Move form + QR */}
        <div className="card p-6 flex flex-col gap-5">
          {!product ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 text-muted">
              <Package size={40} strokeWidth={1.2} className="text-primary/60" />
              <p>Select a product to generate its QR code.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-ink">{product.name}</p>
                  <p className="text-xs text-muted mt-0.5">{product.sku} · Box {product.box_number}</p>
                </div>
                <Badge tone={CATEGORY_TONE[product.category] || "neutral"}>{product.category}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">Move Quantity</span>
                  <input
                    type="number"
                    min={0}
                    value={moveQty}
                    onChange={(e) => setMoveQty(e.target.value)}
                    className="input-field"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">Source</span>
                  <select value={src} onChange={(e) => setSrc(e.target.value)} className="input-field">
                    {rackOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">Destination</span>
                  <select value={dst} onChange={(e) => setDst(e.target.value)} className="input-field">
                    <option value="">Select…</option>
                    {rackOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2 text-sm text-ink">
                <span className="font-medium">{product.name} × {moveQty || 0}</span>
                <span className="text-muted">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Badge tone="info">{src || "—"}</Badge>
                  <ArrowRight size={16} className="text-primary" />
                  <Badge tone="success">{dst || "—"}</Badge>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
                <div className="p-4 bg-white rounded-2xl shadow-soft shrink-0">
                  <QRCodeCanvas ref={canvasRef} value={qrValue} size={200} marginSize={2} level="M" />
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <div className="text-xs text-muted grid grid-cols-2 gap-x-4 gap-y-1.5 mb-2">
                    <span>SKU</span><span className="text-ink text-right">{product.sku}</span>
                    <span>Box</span><span className="text-ink text-right">{product.box_number}</span>
                    <span>Rack</span><span className="text-ink text-right">{product.rack}</span>
                    <span>Min / Max</span><span className="text-ink text-right">{product.minimum_stock} / {product.maximum_stock}</span>
                  </div>
                  <button onClick={downloadPng} className="btn-primary ripple flex items-center justify-center gap-2 text-sm">
                    <Download size={16} /> Download PNG
                  </button>
                  <button onClick={() => window.print()} className="btn-secondary ripple flex items-center justify-center gap-2 text-sm">
                    <Printer size={16} /> Print
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
