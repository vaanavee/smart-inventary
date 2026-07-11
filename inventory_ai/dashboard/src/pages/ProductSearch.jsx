import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { monitorApi } from "../api/monitorClient.js";
import { api } from "../api/client.js";
import { Search, Eye, History, PlusCircle } from "lucide-react";

export default function ProductSearch() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [searchText, setSearchText] = useState("Bosch GSB 12V Drill");
  const [queryText, setQueryText] = useState("Bosch GSB 12V Drill");
  const [selectedRoom, setSelectedRoom] = useState("All rooms");
  const [selectedSku, setSelectedSku] = useState("PRD-0412");

  // Load products & movements
  useEffect(() => {
    monitorApi.get("/products")
      .then((res) => {
        if (res) setProducts(res);
      })
      .catch(() => {
        // Mock fallback if offline
        setProducts([
          { name: "Bosch GSB 12V Cordless Drill", product_id: "PRD-0412", room: "Room 2", rack: "A", qty: 34, unit: "pcs" },
          { name: "M8 Hex Bolts (Box of 100)", product_id: "PRD-0188", room: "Room 1", rack: "B", qty: 240, unit: "pcs" },
          { name: "2.5mm² Copper Wire Spool", product_id: "PRD-0207", room: "Room 3", rack: "C", qty: 42, unit: "rolls" },
          { name: "Makita Angle Grinder", product_id: "PRD-0355", room: "Room 2", rack: "B", qty: 18, unit: "pcs" },
          { name: "PVC Conduit Pipe 25mm", product_id: "PRD-0421", room: "Room 3", rack: "A", qty: 610, unit: "pcs" },
          { name: "Stainless Washers M8", product_id: "PRD-0509", room: "Room 1", rack: "A", qty: 1180, unit: "pcs" },
          { name: "LED Panel 18W", product_id: "PRD-0533", room: "Room 3", rack: "D", qty: 27, unit: "pcs" },
          { name: "Cordless Impact Driver", product_id: "PRD-0560", room: "Room 2", rack: "C", qty: 9, unit: "pcs" },
          { name: "Cordless Drill Battery 12V", product_id: "PRD-0771", room: "Room 2", rack: "A", qty: 31, unit: "pcs" }
        ]);
      });

    const todayStr = new Date().toISOString().slice(0, 10);
    monitorApi.get(`/movements?date=${todayStr}`)
      .then((res) => {
        if (res) setMovements(res);
      })
      .catch(() => {
        setMovements([
          { employee_name: "Vishali Nair", product_name: "Bosch GSB 12V Drill", product_id: "PRD-0412", action: "OUT", quantity: 3, room: "Room 2", rack: "A", entry_time: "09:14", date: "10 Jul" }
        ]);
      });
  }, []);

  const getProductSku = (p) => {
    return p.product_id || p.sku || "";
  };

  const getCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes("drill") || n.includes("grinder") || n.includes("driver") || n.includes("tool")) return "Power Tools";
    if (n.includes("bolt") || n.includes("washer") || n.includes("screw") || n.includes("nut") || n.includes("fastener") || n.includes("clip")) return "Fasteners";
    return "Electricals";
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setQueryText(searchText);

    if (!searchText.trim()) {
      setSelectedSku("");
      return;
    }

    const tokens = searchText.toLowerCase().split(/\s+/).filter(Boolean);

    // Search for a matching product SKU/name using token matching
    const matched = products.find(p => {
      const nameLower = p.name.toLowerCase();
      const skuLower = getProductSku(p).toLowerCase();
      return tokens.every(token => nameLower.includes(token) || skuLower.includes(token));
    });

    if (matched) {
      setSelectedSku(getProductSku(matched));
    } else {
      setSelectedSku("");
    }
  };

  // Pick selected product details
  const selectedProduct = useMemo(() => {
    return products.find(p => getProductSku(p) === selectedSku) || null;
  }, [products, selectedSku]);

  // Find last movement for this selected product
  const lastProductMove = useMemo(() => {
    return movements.find(m => getProductSku(m) === selectedSku) || null;
  }, [movements, selectedSku]);

  // Filter other matches based on search query
  const otherMatches = useMemo(() => {
    if (!queryText.trim()) return [];
    const tokens = queryText.toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      const nameLower = p.name.toLowerCase();
      const skuLower = getProductSku(p).toLowerCase();
      const matchesSearch = tokens.every(token => nameLower.includes(token) || skuLower.includes(token));
      const matchesRoom = selectedRoom === "All rooms" || p.room === selectedRoom;
      const isNotCurrent = getProductSku(p) !== selectedSku;
      return matchesSearch && matchesRoom && isNotCurrent;
    });
  }, [products, queryText, selectedRoom, selectedSku]);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 -mb-2">
        <Link to="/" className="hover:underline text-slate-400">Home</Link>
        <span className="text-slate-300">/</span>
        <span>Inventory</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">Product Search</span>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">Product Search</h1>
        <div className="text-sm text-slate-400 mt-2">
          Find any product and see exactly where it lives
        </div>
      </div>

      {/* Search Input Bar Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft">
        <form onSubmit={handleSearchSubmit} className="flex gap-3 max-w-2xl">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="input-field pl-10 pr-4 py-3 text-base rounded-lg border border-slate-200 bg-white"
            />
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-primary hover:bg-primary-dark text-white text-base font-semibold rounded-lg transition-colors shadow-soft"
          >
            Search
          </button>
        </form>
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {["All rooms", "Room 1", "Room 2", "Room 3"].map((room) => (
            <button
              key={room}
              onClick={() => setSelectedRoom(room)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                selectedRoom === room
                  ? "bg-primary-50 border-primary text-primary font-semibold"
                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
              }`}
            >
              {room}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Result Card */}
      {selectedProduct ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft animate-fadeIn flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary flex items-center justify-center text-3xl shrink-0">
                🔩
              </div>
              <div>
                <h2 className="font-display font-bold text-slate-900 text-lg leading-tight">
                  {selectedProduct.name}
                </h2>
                <div className="text-xs font-mono text-slate-400 mt-1">
                  {getProductSku(selectedProduct)} · {getCategory(selectedProduct.name)} · unit: {selectedProduct.unit || "pcs"}
                </div>
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border leading-none ${
              selectedProduct.qty < 50
                ? "bg-amber-50 text-amber-600 border-amber-100"
                : "bg-emerald-50 text-emerald-600 border-emerald-100"
            }`}>
              ● {selectedProduct.qty < 50 ? "Low stock" : "OK"} · {selectedProduct.qty} / min 50
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-b border-slate-100 py-6">
            <div>
              <div className="text-xs text-slate-400 font-medium">Located in</div>
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-sm font-semibold mt-2 shadow-soft">
                📍 {selectedProduct.room} · Rack {selectedProduct.rack}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Current stock</div>
              <div className="text-3xl font-bold text-slate-800 mt-1.5 leading-none">
                {selectedProduct.qty} <span className="text-sm text-slate-400 font-medium">{selectedProduct.unit || "pcs"}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Last movement</div>
              {lastProductMove ? (
                <div className="mt-1.5">
                  <div className="font-semibold text-slate-800 text-sm">
                    {lastProductMove.action} ×{lastProductMove.quantity || 1} · {lastProductMove.date || "Today"} {lastProductMove.entry_time}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">by {lastProductMove.employee_name}</div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 mt-2.5">
                  No movements recorded today.
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link
              to="/products"
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded transition-colors flex items-center gap-1.5"
            >
              <Eye size={14} /> View QR
            </Link>
            <Link
              to="/verification"
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded transition-colors flex items-center gap-1.5"
            >
              <History size={14} /> Movement history
            </Link>
            <Link
              to="/verification"
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded transition-colors shadow-soft flex items-center gap-1.5"
            >
              <PlusCircle size={14} /> Record movement
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 shadow-soft">
          Type in product SKU or name above and click search.
        </div>
      )}

      {/* Other Matches */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">Other matches</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
            {otherMatches.length} more
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Stock</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {otherMatches.slice(0, 4).map((p) => (
                <tr key={getProductSku(p)} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-900 font-medium">{p.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{getProductSku(p)}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{p.room} · Rack {p.rack}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{p.qty} {p.unit || "pcs"}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setSelectedSku(getProductSku(p));
                        setSearchText(p.name);
                      }}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-primary text-xs font-semibold rounded transition-colors"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {otherMatches.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-5 py-8 text-center text-xs text-slate-400">
                    No other matching products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-slate-400 mt-2 text-center text-[11px]">
        Designed & Developed by Vishali, Suraj and Vaanavee as part of the WisRight Innovation Internship Program (WR-IIP) held during June-July 2026
      </div>
    </div>
  );
}
