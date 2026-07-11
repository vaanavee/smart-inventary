import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Package, QrCode, Search, Download, Printer } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { monitorApi } from "../api/monitorClient.js";
import { QRCodeCanvas } from "qrcode.react";

export default function Products() {
  const [tab, setTab] = useState("catalog"); // "catalog" | "qr"
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null if adding

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formCategory, setFormCategory] = useState("Power Tools");
  const [formUnit, setFormUnit] = useState("pcs");
  const [formRoom, setFormRoom] = useState("Room 1");
  const [formRack, setFormRack] = useState("A");
  const [formStock, setFormStock] = useState("");

  // QR Tab Selection State
  const [selectedQrSku, setSelectedQrSku] = useState("");
  const qrCanvasRef = useRef(null);

  // Helper to dynamically categorize products
  const getCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes("drill") || n.includes("grinder") || n.includes("driver") || n.includes("tool")) return "Power Tools";
    if (n.includes("bolt") || n.includes("washer") || n.includes("screw") || n.includes("nut") || n.includes("fastener") || n.includes("clip")) return "Fasteners";
    if (n.includes("wire") || n.includes("conduit") || n.includes("cable") || n.includes("panel") || n.includes("led") || n.includes("electrical")) return "Electricals";
    if (n.includes("pencil") || n.includes("marker") || n.includes("pen") || n.includes("scale") || n.includes("sharpener") || n.includes("glue") || n.includes("highlighter") || n.includes("sketch") || n.includes("eraser") || n.includes("ruler")) return "Stationery";
    if (n.includes("notebook") || n.includes("book")) return "Books";
    if (n.includes("calculator") || n.includes("usb") || n.includes("mouse") || n.includes("keyboard") || n.includes("headphones") || n.includes("charger")) return "Electronics";
    if (n.includes("folder") || n.includes("paper") || n.includes("stapler") || n.includes("tape") || n.includes("scissors") || n.includes("clipboard") || n.includes("envelope") || n.includes("notes") || n.includes("binder")) return "Office Supplies";
    return "Accessories";
  };

  // Helper to get stock status
  const getStatus = (qty) => {
    if (qty < 20) return { label: "● Critical", tone: "danger" };
    if (qty < 50) return { label: "● Low", tone: "warning" };
    return { label: "● OK", tone: "success" };
  };

  // Load products from API & LocalStorage
  const loadProducts = () => {
    monitorApi.get("/products")
      .then((res) => {
        // Retrieve local additions from localStorage
        const stored = localStorage.getItem("local-products");
        const localList = stored ? JSON.parse(stored) : [];

        // Combine API products and local additions, filtering duplicates by product_id/sku
        const combined = [...res];
        localList.forEach((localItem) => {
          if (!combined.some(p => p.product_id === localItem.product_id)) {
            combined.push(localItem);
          }
        });
        setProducts(combined);

        // Pre-select first product for QR tab if empty
        if (combined.length > 0 && !selectedQrSku) {
          setSelectedQrSku(combined[0].product_id);
        }
      })
      .catch(() => {
        // Fallback mockup list if offline
        const mockFallback = [
          { name: "Bosch GSB 12V Cordless Drill", product_id: "PRD-0412", room: "Room 2", rack: "A", qty: 34, unit: "pcs" },
          { name: "M8 Hex Bolts (Box of 100)", product_id: "PRD-0188", room: "Room 1", rack: "B", qty: 240, unit: "pcs" },
          { name: "2.5mm² Copper Wire Spool", product_id: "PRD-0207", room: "Room 3", rack: "C", qty: 42, unit: "rolls" },
          { name: "Makita Angle Grinder", product_id: "PRD-0355", room: "Room 2", rack: "B", qty: 18, unit: "pcs" },
          { name: "PVC Conduit Pipe 25mm", product_id: "PRD-0421", room: "Room 3", rack: "A", qty: 610, unit: "pcs" },
          { name: "Stainless Washers M8", product_id: "PRD-0509", room: "Room 1", rack: "A", qty: 1180, unit: "pcs" },
          { name: "LED Panel 18W", product_id: "PRD-0533", room: "Room 3", rack: "D", qty: 27, unit: "pcs" },
          { name: "Cordless Impact Driver", product_id: "PRD-0560", room: "Room 2", rack: "C", qty: 9, unit: "pcs" }
        ];
        const stored = localStorage.getItem("local-products");
        const localList = stored ? JSON.parse(stored) : [];
        const combined = [...mockFallback];
        localList.forEach((localItem) => {
          if (!combined.some(p => p.product_id === localItem.product_id)) {
            combined.push(localItem);
          }
        });
        setProducts(combined);
        if (combined.length > 0 && !selectedQrSku) {
          setSelectedQrSku(combined[0].product_id);
        }
      });
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Filter Categories dynamically
  const categoriesList = useMemo(() => {
    const uniq = Array.from(new Set(products.map(p => getCategory(p.name))));
    return ["All", ...uniq];
  }, [products]);

  // Filtered Products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.product_id.toLowerCase().includes(searchText.toLowerCase());
      const cat = getCategory(p.name);
      const matchesCategory = selectedCategory === "All" || cat === selectedCategory;
      const matchesLowStock = !lowStockOnly || p.qty < 50;
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [products, searchText, selectedCategory, lowStockOnly]);

  const roomsCount = new Set(products.map(p => p.room)).size;

  // Modal Open Handler
  const openModal = (productToEdit = null) => {
    if (productToEdit) {
      setEditingProduct(productToEdit);
      setFormName(productToEdit.name);
      setFormSku(productToEdit.product_id);
      setFormCategory(getCategory(productToEdit.name));
      setFormUnit(productToEdit.unit || "pcs");
      setFormRoom(productToEdit.room);
      setFormRack(productToEdit.rack);
      setFormStock(String(productToEdit.qty));
    } else {
      setEditingProduct(null);
      setFormName("");
      setFormSku(`PRD-${Math.floor(1000 + Math.random() * 9000)}`);
      setFormCategory("Power Tools");
      setFormUnit("pcs");
      setFormRoom("Room 1");
      setFormRack("A");
      setFormStock("");
    }
    setModalOpen(true);
  };

  // Save Product Handler
  const saveProduct = (e) => {
    e.preventDefault();
    if (!formName || !formSku || !formRoom || !formRack || formStock === "") {
      alert("Please fill in all required fields.");
      return;
    }

    const updatedQty = Number(formStock);
    const updatedProduct = {
      name: formName,
      product_id: formSku,
      room: formRoom,
      rack: formRack,
      unit: formUnit,
      qty: updatedQty,
      expiry_date: editingProduct?.expiry_date || ""
    };

    const stored = localStorage.getItem("local-products");
    let localList = stored ? JSON.parse(stored) : [];

    if (editingProduct) {
      // Update existing local list and state
      localList = localList.map(p => p.product_id === editingProduct.product_id ? updatedProduct : p);
      // If it was a default product not yet in localList, add it
      if (!localList.some(p => p.product_id === updatedProduct.product_id)) {
        localList.push(updatedProduct);
      }
      localStorage.setItem("local-products", JSON.stringify(localList));

      // Reload products list
      loadProducts();
      alert("Product updated successfully!");
    } else {
      // Add new product
      if (products.some(p => p.product_id === updatedProduct.product_id)) {
        alert("SKU / Product ID already exists. Please choose a unique SKU.");
        return;
      }
      localList.push(updatedProduct);
      localStorage.setItem("local-products", JSON.stringify(localList));

      // Reload products list
      loadProducts();
      setSelectedQrSku(updatedProduct.product_id);
      alert("Product created successfully!");
    }

    setModalOpen(false);
  };

  // Export CSV Handler
  const exportCsv = () => {
    const headers = "Product,SKU,Category,Location,Stock,Status\n";
    const rows = products.map(p => `"${p.name}","${p.product_id}","${getCategory(p.name)}","${p.room} · Rack ${p.rack}",${p.qty} ${p.unit || "pcs"},"${getStatus(p.qty).label.replace("● ", "")}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_catalog.csv";
    a.click();
  };

  // Selected QR Product Details
  const selectedQrProduct = useMemo(() => {
    return products.find(p => p.product_id === selectedQrSku) || null;
  }, [products, selectedQrSku]);

  // Encoded JSON payload string
  const qrPayloadString = useMemo(() => {
    if (!selectedQrProduct) return "";
    return JSON.stringify({
      t: "wisright-product",
      v: 1,
      sku: selectedQrProduct.product_id,
      name: selectedQrProduct.name,
      cat: getCategory(selectedQrProduct.name),
      room: selectedQrProduct.room,
      rack: selectedQrProduct.rack,
      unit: selectedQrProduct.unit || "pcs"
    }, null, 2);
  }, [selectedQrProduct]);

  // Download QR Code image
  const downloadQrPng = () => {
    if (!qrCanvasRef.current || !selectedQrProduct) return;
    const canvas = qrCanvasRef.current.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR_${selectedQrProduct.product_id}.png`;
    a.click();
  };

  // Print Label dialog handler
  const printLabel = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 -mb-2">
        <Link to="/" className="hover:underline text-slate-400">Home</Link>
        <span className="text-slate-300">/</span>
        <span>Inventory</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">Products</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">Products</h1>
          <div className="text-sm text-slate-400 mt-2">
            {products.length} products across {roomsCount} rooms · low-stock threshold 50 units
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            Export CSV
          </button>
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex gap-2 border-b border-hairline/10 mb-5 overflow-x-auto w-full">
        <button
          onClick={() => setTab("catalog")}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-medium border-b-2 bg-transparent transition-all hover:text-ink ${
            tab === "catalog" ? "border-primary text-primary font-semibold" : "border-transparent text-muted"
          }`}
        >
          Catalog
        </button>
        <button
          onClick={() => setTab("qr")}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-medium border-b-2 bg-transparent transition-all hover:text-ink ${
            tab === "qr" ? "border-primary text-primary font-semibold" : "border-transparent text-muted"
          }`}
        >
          QR Codes
        </button>
      </div>

      {/* TAB CONTENT: CATALOG */}
      {tab === "catalog" && (
        <div className="flex flex-col gap-6 animate-fadeIn">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="input-field pl-9 pr-4 py-2 text-sm w-64 rounded-lg border border-slate-200 bg-white"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                    selectedCategory === cat
                      ? "bg-primary-50 border-primary text-primary font-semibold"
                      : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <span className="flex-grow"></span>

            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                lowStockOnly
                  ? "bg-amber-50 border-amber-300 text-amber-600 font-semibold"
                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
              }`}
            >
              Low stock only
            </button>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">Catalog</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                {filteredProducts.length} of {products.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Stock</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const status = getStatus(p.qty);
                    return (
                      <tr key={p.product_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 text-slate-900 font-medium">{p.name}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{p.product_id}</td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{getCategory(p.name)}</td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{p.room} · Rack {p.rack}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{p.qty} {p.unit || "pcs"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border leading-none ${
                            status.tone === "success"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : status.tone === "warning"
                              ? "bg-amber-50 text-amber-600 border-amber-100"
                              : "bg-red-50 text-red-600 border-red-100"
                          }`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedQrSku(p.product_id);
                              setTab("qr");
                            }}
                            className="px-2 py-1 text-xs font-semibold text-primary hover:underline bg-transparent border-0"
                          >
                            QR
                          </button>
                          <button
                            onClick={() => openModal(p)}
                            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded transition-colors ml-2"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-5 py-8 text-center text-xs text-slate-400">
                        No products match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Showing {filteredProducts.length} of {products.length} products</span>
              <div className="flex gap-1">
                <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center bg-primary text-white font-medium">1</button>
                <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">2</button>
                <button className="w-7 h-7 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-50 text-slate-600">›</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: QR CODES */}
      {tab === "qr" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-soft animate-fadeIn p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <select
                value={selectedQrSku}
                onChange={(e) => setSelectedQrSku(e.target.value)}
                className="input-field w-64 rounded-lg border border-slate-200 bg-white"
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name} · {p.product_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadQrPng}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft flex items-center gap-1.5"
              >
                <Download size={14} /> Download PNG
              </button>
              <button
                onClick={printLabel}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Printer size={14} /> Print label
              </button>
            </div>
          </div>

          {selectedQrProduct ? (
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 items-start">
              {/* QR Panel */}
              <div className="flex flex-col items-center text-center">
                <div ref={qrCanvasRef} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-soft inline-block">
                  <QRCodeCanvas
                    value={qrPayloadString}
                    size={216}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="mt-4 font-bold text-slate-900 text-base">{selectedQrProduct.name}</div>
                <div className="text-xs text-slate-400 mt-1 font-mono">{selectedQrProduct.product_id}</div>
              </div>

              {/* QR Metadata */}
              <div className="flex flex-col gap-4">
                <h3 className="font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2">Encoded in this QR</h3>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-400">Product</span>
                  <span className="font-semibold text-slate-800">{selectedQrProduct.name}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-400">SKU</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedQrProduct.product_id}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-400">Category</span>
                  <span className="font-semibold text-slate-800">{getCategory(selectedQrProduct.name)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-400">Home location</span>
                  <span className="font-semibold text-slate-800">{selectedQrProduct.room} · Rack {selectedQrProduct.rack}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-400">Unit</span>
                  <span className="font-semibold text-slate-800">{selectedQrProduct.unit || "pcs"}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-400">Low-stock min</span>
                  <span className="font-semibold text-slate-800">50</span>
                </div>

                <div className="p-3 bg-blue-50/30 border border-blue-100 text-blue-900 text-xs rounded-lg flex gap-2 items-start mt-2">
                  <span className="shrink-0 mt-0.5">ℹ️</span>
                  <div>
                    The QR payload is <strong>self-contained JSON</strong> — a worker's scanner reads the product identity directly, no backend call needed.
                  </div>
                </div>

                <h4 className="font-semibold text-slate-800 text-xs mt-4 mb-2">Payload preview</h4>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-600 whitespace-pre-wrap word-break-all">
                  {qrPayloadString}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 py-10 text-center">
              No product selected.
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lift w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900 text-base">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-medium"
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveProduct} className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-blue-50/30 border border-blue-100 text-blue-900 text-xs rounded-lg flex gap-2 items-start">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <div>
                  Mockup form — submitting updates the local application state; nothing is saved to backend. A QR code is generated automatically on save.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Product Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bosch GSB 12V Drill"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">SKU / Product ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    disabled={!!editingProduct}
                    placeholder="PRD-0000"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Category <span className="text-red-500">*</span></label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Fasteners">Fasteners</option>
                    <option value="Power Tools">Power Tools</option>
                    <option value="Electricals">Electricals</option>
                    <option value="Stationery">Stationery</option>
                    <option value="Books">Books</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="pcs">pcs</option>
                    <option value="rolls">rolls</option>
                    <option value="box">box</option>
                    <option value="m">m</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Room <span className="text-red-500">*</span></label>
                  <select
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Room 1">Room 1</option>
                    <option value="Room 2">Room 2</option>
                    <option value="Room 3">Room 3</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Rack <span className="text-red-500">*</span></label>
                  <select
                    value={formRack}
                    onChange={(e) => setFormRack(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Opening Stock <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-400 mt-2 font-medium">
                Products below 50 units are flagged as low-stock automatically.
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors shadow-soft"
                >
                  {editingProduct ? "Save changes" : "Save & generate QR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="text-slate-400 mt-2 text-center text-[11px]">
        Static mockup fallback loaded when database connection is inactive · Not a real application.
      </div>
    </div>
  );
}
