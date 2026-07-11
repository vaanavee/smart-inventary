import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Upload, ArrowRight, Package, ScanLine, RotateCcw, Check, Sparkles, LogOut, ArrowRightLeft, LogIn } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { decodeProductQR } from "../utils/qrPayload.js";

const CAMERA_ID = "qr-reader";
const FILE_ID = "qr-reader-file";

export default function QrScanner() {
  // Steps: "scan" | "update" | "confirm"
  const [step, setStep] = useState("scan");
  
  // Scanner state
  const [mode, setMode] = useState("camera"); // "camera" | "upload"
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef(null);

  // Scanned Product Details
  const [scannedProduct, setScannedProduct] = useState(null);

  // Update Form State
  const [movementType, setMovementType] = useState("OUT"); // "IN" | "OUT" | "TRANSFER"
  const [qty, setQty] = useState(3);
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [notes, setNotes] = useState("");
  const [recordedBy, setRecordedBy] = useState("Vishali Nair · EMP-101");

  // Confirmation Details
  const [confirmDetails, setConfirmDetails] = useState(null);

  // List of last scans (local state)
  const [lastScans, setLastScans] = useState([
    { name: "Copper Wire", sku: "PRD-0207", type: "OUT", qty: 5 },
    { name: "Grinder", sku: "PRD-0355", type: "Transfer", qty: 1 },
    { name: "Hex Bolts", sku: "PRD-0188", type: "IN", qty: 20 }
  ]);

  // Clean stop camera when unmounting
  const stopCamera = async () => {
    const inst = cameraRef.current;
    cameraRef.current = null;
    if (inst) {
      try {
        await inst.stop();
        await inst.clear();
      } catch {
        /* already stopped */
      }
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  // Fetch logged in user to display in Recorded By
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const u = JSON.parse(storedUser);
        setRecordedBy(`${u.name || "User"} · ${u.empId || "EMP-100"}`);
      }
    } catch {}
  }, []);

  const handleDecoded = (text) => {
    try {
      const decoded = decodeProductQR(text);
      // Map decoded keys to standardized product properties
      const mappedProduct = {
        name: decoded.name,
        product_id: decoded.sku,
        room: decoded.room || "Room 2",
        rack: decoded.rack || "A",
        qty: decoded.qty || 34,
        unit: decoded.unit || "pcs"
      };
      
      setScannedProduct(mappedProduct);
      setFromLoc(`${mappedProduct.room} · Rack ${mappedProduct.rack}`);
      setToLoc(movementType === "OUT" ? "Dispatch / Out" : `${mappedProduct.room} · Rack ${mappedProduct.rack}`);
      setError("");
      setStep("update");
    } catch (e) {
      setError("Invalid WisRight QR payload. Try Simulation Scan.");
    }
  };

  // Start Camera QR reader
  const startCamera = async () => {
    setError("");
    try {
      const inst = new Html5Qrcode(CAMERA_ID);
      cameraRef.current = inst;
      setScanning(true);
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (decoded) => {
          handleDecoded(decoded);
          stopCamera();
        },
        () => {} // frame errors
      );
    } catch (e) {
      cameraRef.current = null;
      setScanning(false);
      setError("Could not start camera. Grant camera permission or use Simulation.");
    }
  };

  // File Upload QR decode handler
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await stopCamera();
    setError("");
    try {
      const inst = new Html5Qrcode(FILE_ID);
      const decoded = await inst.scanFile(file, false);
      await inst.clear();
      handleDecoded(decoded);
    } catch {
      setError("No valid QR code found in that image.");
    }
  };

  const switchMode = async (next) => {
    if (next === mode) return;
    await stopCamera();
    setMode(next);
  };

  // Simulate scanning of Bosch Drill
  const handleSimulateScan = () => {
    const simulatedPayload = JSON.stringify({
      t: "wisright-product",
      v: 1,
      sku: "PRD-0412",
      name: "Bosch GSB 12V Cordless Drill",
      cat: "Power Tools",
      room: "Room 2",
      rack: "A",
      unit: "pcs",
      qty: 34
    });
    handleDecoded(simulatedPayload);
    stopCamera();
  };

  // Save movement handler
  const handleSaveMovement = () => {
    if (!scannedProduct) return;

    // Load active products list to modify stock
    const stored = localStorage.getItem("local-products");
    let productsList = [];
    if (stored) {
      productsList = JSON.parse(stored);
    } else {
      // Default initial mock list if local storage has nothing
      productsList = [
        { name: "Bosch GSB 12V Cordless Drill", product_id: "PRD-0412", room: "Room 2", rack: "A", qty: 34, unit: "pcs" },
        { name: "M8 Hex Bolts (Box of 100)", product_id: "PRD-0188", room: "Room 1", rack: "B", qty: 240, unit: "pcs" },
        { name: "2.5mm² Copper Wire Spool", product_id: "PRD-0207", room: "Room 3", rack: "C", qty: 42, unit: "rolls" },
        { name: "Makita Angle Grinder", product_id: "PRD-0355", room: "Room 2", rack: "B", qty: 18, unit: "pcs" },
        { name: "PVC Conduit Pipe 25mm", product_id: "PRD-0421", room: "Room 3", rack: "A", qty: 610, unit: "pcs" }
      ];
    }

    // Find the product match
    const pIdx = productsList.findIndex(p => p.product_id === scannedProduct.product_id);
    let oldQty = scannedProduct.qty;
    let newQty = oldQty;

    if (pIdx !== -1) {
      oldQty = productsList[pIdx].qty;
      if (movementType === "IN") {
        newQty = oldQty + Number(qty);
      } else if (movementType === "OUT") {
        newQty = Math.max(0, oldQty - Number(qty));
      }
      // Update quantity
      productsList[pIdx].qty = newQty;

      // If TRANSFER, update location details
      if (movementType === "TRANSFER") {
        const parts = toLoc.split(" · Rack ");
        if (parts.length === 2) {
          productsList[pIdx].room = parts[0];
          productsList[pIdx].rack = parts[1];
        }
      }
    } else {
      // Product not in inventory list, create it
      if (movementType === "IN") {
        newQty = Number(qty);
      } else if (movementType === "OUT") {
        newQty = 0;
      }
      const newProd = {
        name: scannedProduct.name,
        product_id: scannedProduct.product_id,
        room: scannedProduct.room,
        rack: scannedProduct.rack,
        qty: newQty,
        unit: scannedProduct.unit,
        expiry_date: ""
      };
      productsList.push(newProd);
    }

    // Save modified list back to localStorage
    localStorage.setItem("local-products", JSON.stringify(productsList));

    // Save confirmation details
    const refCode = `MOV-${Math.floor(100000 + Math.random() * 900000)}`;
    setConfirmDetails({
      ref: refCode,
      product: `${scannedProduct.name} · ${scannedProduct.product_id}`,
      movement: `${movementType} ×${qty}`,
      type: movementType,
      locs: movementType === "TRANSFER" ? `${fromLoc} → ${toLoc}` : `${fromLoc} → ${toLoc}`,
      by: recordedBy,
      time: `${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric", hour12: false })}`,
      newStock: `${newQty} ${scannedProduct.unit}`
    });

    // Save to local-movements list for Attendance Match
    try {
      const storedMoves = localStorage.getItem("local-movements");
      const movesList = storedMoves ? JSON.parse(storedMoves) : [];
      const newMove = {
        ref: refCode,
        employee_name: recordedBy.split(" · ")[0],
        product_name: scannedProduct.name.split(" ")[0],
        action: movementType === "TRANSFER" ? "Transfer" : movementType,
        quantity: qty,
        room: scannedProduct.room,
        rfid_time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        qr_time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
      };
      movesList.unshift(newMove);
      localStorage.setItem("local-movements", JSON.stringify(movesList));
    } catch (e) {
      console.error(e);
    }

    // Add to top of last scans history list
    setLastScans(prev => [
      { name: scannedProduct.name.split(" ")[0], sku: scannedProduct.product_id, type: movementType === "TRANSFER" ? "Transfer" : movementType, qty },
      ...prev.slice(0, 4)
    ]);

    setStep("confirm");
  };

  const handleResetFlow = () => {
    setScannedProduct(null);
    setQty(3);
    setNotes("");
    setStep("scan");
  };

  return (
    <div className="flex flex-col gap-6 font-display">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 -mb-2">
        <Link to="/" className="hover:underline text-slate-400">Home</Link>
        <span className="text-slate-300">/</span>
        <span>Operations</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">QR Scanner</span>
      </div>

      {/* Navigation Tabs (mockup style) */}
      <div className="flex gap-2 border-b border-slate-100 -mb-2 overflow-x-auto w-full">
        <button
          onClick={async () => {
            await stopCamera();
            setStep("scan");
          }}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 bg-transparent transition-all ${
            step === "scan" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Scan
        </button>
        <button
          onClick={async () => {
            await stopCamera();
            if (!scannedProduct) {
              setScannedProduct({
                name: "Bosch GSB 12V Cordless Drill",
                product_id: "PRD-0412",
                room: "Room 2",
                rack: "A",
                qty: 34,
                unit: "pcs"
              });
              setFromLoc("Room 2 · Rack A");
              setToLoc("Dispatch / Out");
            }
            setStep("update");
          }}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 bg-transparent transition-all ${
            step === "update" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Update Movement
        </button>
        <button
          onClick={async () => {
            await stopCamera();
            if (!confirmDetails) {
              setConfirmDetails({
                ref: "MOV-004824",
                product: "Bosch GSB 12V Cordless Drill · PRD-0412",
                movement: "OUT ×3",
                type: "OUT",
                locs: "Room 2 · Rack A → Dispatch",
                by: recordedBy || "Vishali Nair · EMP-101",
                time: "10 Jul 2026 · 09:52",
                newStock: "31 pcs"
              });
            }
            setStep("confirm");
          }}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 bg-transparent transition-all ${
            step === "confirm" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Confirmation
        </button>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 leading-none">
          {step === "scan" && "Scan a Product QR"}
          {step === "update" && "Update Movement"}
          {step === "confirm" && "Confirmation"}
        </h1>
        <div className="text-sm text-slate-400 mt-2">
          {step === "scan" && "Point the camera at a product QR to record a movement"}
          {step === "update" && "Details pre-filled from the scanned QR · confirm the movement"}
          {step === "confirm" && "Inventory movement verified and logged successfully"}
        </div>
      </div>

      {/* Step Wizard indicator */}
      <div className="flex gap-2 mb-2 overflow-x-auto w-full">
        <button
          onClick={async () => {
            await stopCamera();
            setStep("scan");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold bg-transparent transition-all ${
            step === "scan"
              ? "border-[#4f46e5] bg-[#eef2ff]/50 text-[#4f46e5]"
              : "border-emerald-200 bg-emerald-50 text-emerald-600 font-bold"
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
            step === "scan" ? "bg-[#4f46e5] text-white" : "bg-emerald-500 text-white"
          }`}>
            {step === "scan" ? "1" : "✓"}
          </span>
          Scan
        </button>
        <button
          onClick={async () => {
            await stopCamera();
            if (!scannedProduct) {
              setScannedProduct({
                name: "Bosch GSB 12V Cordless Drill",
                product_id: "PRD-0412",
                room: "Room 2",
                rack: "A",
                qty: 34,
                unit: "pcs"
              });
              setFromLoc("Room 2 · Rack A");
              setToLoc("Dispatch / Out");
            }
            setStep("update");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold bg-transparent transition-all ${
            step === "update"
              ? "border-[#4f46e5] bg-[#eef2ff]/50 text-[#4f46e5]"
              : step === "confirm"
              ? "border-emerald-200 bg-emerald-50 text-emerald-600 font-bold"
              : "border-slate-200 bg-slate-50 text-slate-400"
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
            step === "update" ? "bg-[#4f46e5] text-white" : step === "confirm" ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
          }`}>
            {step === "confirm" ? "✓" : "2"}
          </span>
          Update Movement
        </button>
        <button
          onClick={async () => {
            await stopCamera();
            if (!confirmDetails) {
              setConfirmDetails({
                ref: "MOV-004824",
                product: "Bosch GSB 12V Cordless Drill · PRD-0412",
                movement: "OUT ×3",
                type: "OUT",
                locs: "Room 2 · Rack A → Dispatch",
                by: recordedBy || "Vishali Nair · EMP-101",
                time: "10 Jul 2026 · 09:52",
                newStock: "31 pcs"
              });
            }
            setStep("confirm");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold bg-transparent transition-all ${
            step === "confirm"
              ? "border-[#4f46e5] bg-[#eef2ff]/50 text-[#4f46e5]"
              : "border-slate-200 bg-slate-50 text-slate-400"
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
            step === "confirm" ? "bg-[#4f46e5] text-white" : "bg-slate-200 text-slate-500"
          }`}>
            3
          </span>
          Confirm
        </button>
      </div>

      {/* STEP 1: SCAN SCREEN */}
      {step === "scan" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start animate-fadeIn">
          {/* Scanner Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft">
            <div className="flex gap-2 border-b border-slate-100 mb-5 overflow-x-auto w-full">
              <button
                onClick={() => switchMode("camera")}
                className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 bg-transparent transition-all ${
                  mode === "camera" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Camera size={15} /> Scan camera
              </button>
              <button
                onClick={() => switchMode("upload")}
                className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 bg-transparent transition-all ${
                  mode === "upload" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Upload size={15} /> Upload image
              </button>
            </div>

            {mode === "camera" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-[4/3] w-full max-w-lg shadow-soft flex items-center justify-center text-slate-500">
                  <div id={CAMERA_ID} className="w-full h-full" />
                  
                  {scanning && (
                    <div className="pointer-events-none absolute inset-x-8 top-0 h-0.5 bg-primary/80 shadow-glow animate-scanLine z-10" />
                  )}

                  {!scanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 p-6 text-center">
                      <ScanLine size={48} strokeWidth={1.5} className="text-primary" />
                      <p className="font-semibold text-slate-300">Point camera at a product QR label</p>
                      <p className="text-xs text-slate-500">Starts local webcam streaming directly inside sandbox</p>
                    </div>
                  )}

                  {/* Finder target indicator overlay */}
                  <div className="absolute w-48 h-48 border border-white/20 rounded-2xl pointer-events-none z-10 flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  </div>
                </div>

                <div className="flex gap-2">
                  {scanning ? (
                    <button
                      onClick={stopCamera}
                      className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      Stop Camera
                    </button>
                  ) : (
                    <button
                      onClick={startCamera}
                      className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-colors shadow-soft flex items-center gap-2"
                    >
                      <Camera size={16} /> Start Camera
                    </button>
                  )}

                  <button
                    onClick={handleSimulateScan}
                    className="px-4 py-2.5 bg-orange-50 border border-orange-100 hover:bg-orange-100 text-orange-700 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles size={14} /> Simulate Scan (Bosch Drill)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <label className="flex flex-col items-center justify-center gap-3 aspect-[4/3] w-full max-w-lg rounded-2xl border-2 border-dashed border-slate-300 hover:border-primary/50 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all text-slate-500 text-center p-6">
                  <Upload size={40} strokeWidth={1.5} className="text-primary/70" />
                  <div>
                    <span className="font-semibold text-slate-800">Click to upload a QR code image</span>
                    <p className="text-xs text-slate-400 mt-1">Accepts PNG, JPG, JPEG files</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
              </div>
            )}

            {/* Hidden reader element needed by html5-qrcode */}
            <div id={FILE_ID} className="hidden" />

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            {/* How it works */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
              <h3 className="font-display font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-3">How it works</h3>
              <ol className="flex flex-col gap-2.5 text-xs text-slate-600 list-decimal pl-4 font-medium">
                <li>Scan the product's QR code</li>
                <li>Its details pre-fill automatically</li>
                <li>Pick IN / OUT / Transfer + quantity</li>
                <li>Confirm — logged & cross-checked</li>
              </ol>
            </div>

            {/* Last scans history */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-soft">
              <h3 className="font-display font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-3">Last scans</h3>
              <ul className="flex flex-col gap-3">
                {lastScans.map((s, idx) => (
                  <li key={idx} className="flex justify-between items-center text-xs">
                    <div>
                      <div className="font-semibold text-slate-800">{s.name}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">{s.sku}</div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full leading-none uppercase ${
                      s.type === "IN"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : s.type === "OUT"
                        ? "bg-red-50 text-red-600 border-red-100"
                        : "bg-blue-50 text-blue-600 border-blue-100"
                    }`}>
                      {s.type} {s.qty > 1 && `×${s.qty}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: UPDATE MOVEMENT SCREEN */}
      {step === "update" && scannedProduct && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-soft p-6 animate-fadeIn flex flex-col gap-6 max-w-3xl mx-auto w-full">
          {/* Prefill Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0">
              🔩
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-slate-800 text-sm">{scannedProduct.name}</h3>
              <div className="text-xs font-mono text-slate-400 mt-1 truncate">
                {scannedProduct.product_id} · Power Tools · currently {scannedProduct.qty} {scannedProduct.unit} at {scannedProduct.room} · Rack {scannedProduct.rack}
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center gap-1">
              ✓ Scanned
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {/* Action Segment Cards */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-700">Movement type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMovementType("IN");
                    setToLoc(`${scannedProduct.room} · Rack ${scannedProduct.rack}`);
                  }}
                  className={`flex flex-col items-center justify-center py-4 px-3 border-2 rounded-xl transition-all ${
                    movementType === "IN"
                      ? "border-[#4f46e5] bg-[#eef2ff]/50 text-[#4f46e5]"
                      : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  }`}
                >
                  <span className="text-xl mb-1">📥</span>
                  <span className="font-bold text-sm text-slate-800">Material IN</span>
                  <span className="text-[11px] text-slate-400 font-normal">Add stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovementType("OUT");
                    setToLoc("Dispatch / Out");
                  }}
                  className={`flex flex-col items-center justify-center py-4 px-3 border-2 rounded-xl transition-all ${
                    movementType === "OUT"
                      ? "border-[#4f46e5] bg-[#eef2ff]/50 text-[#4f46e5]"
                      : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  }`}
                >
                  <span className="text-xl mb-1">📤</span>
                  <span className="font-bold text-sm text-slate-800">Material OUT</span>
                  <span className="text-[11px] text-slate-400 font-normal">Remove stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovementType("TRANSFER");
                    setToLoc("Room 1 · Rack A");
                  }}
                  className={`flex flex-col items-center justify-center py-4 px-3 border-2 rounded-xl transition-all ${
                    movementType === "TRANSFER"
                      ? "border-[#4f46e5] bg-[#eef2ff]/50 text-[#4f46e5]"
                      : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  }`}
                >
                  <span className="text-xl mb-1">🔁</span>
                  <span className="font-bold text-sm text-slate-800">Transfer</span>
                  <span className="text-[11px] text-slate-400 font-normal">Move location</span>
                </button>
              </div>
            </div>

            {/* Qty & Recorder */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                />
                <div className="text-[10px] text-slate-400">Available: {scannedProduct.qty} {scannedProduct.unit}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Recorded by</label>
                <input
                  type="text"
                  disabled
                  value={recordedBy}
                  className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-medium"
                />
              </div>
            </div>

            {/* Locations Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">From location <span className="text-red-500">*</span></label>
                <select
                  value={fromLoc}
                  onChange={(e) => setFromLoc(e.target.value)}
                  className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                >
                  <option value={`${scannedProduct.room} · Rack ${scannedProduct.rack}`}>
                    {scannedProduct.room} · Rack {scannedProduct.rack} (current)
                  </option>
                  <option value="Room 1 · Rack A">Room 1 · Rack A</option>
                  <option value="Room 3 · Rack C">Room 3 · Rack C</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">To location <span className="text-red-500">*</span></label>
                {movementType === "OUT" ? (
                  <select
                    disabled
                    value="Dispatch / Out"
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                  >
                    <option value="Dispatch / Out">Dispatch / Out</option>
                  </select>
                ) : movementType === "IN" ? (
                  <select
                    disabled
                    value={`${scannedProduct.room} · Rack ${scannedProduct.rack}`}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                  >
                    <option value={`${scannedProduct.room} · Rack ${scannedProduct.rack}`}>
                      {scannedProduct.room} · Rack {scannedProduct.rack} (current)
                    </option>
                  </select>
                ) : (
                  <select
                    value={toLoc}
                    onChange={(e) => setToLoc(e.target.value)}
                    className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Room 1 · Rack D">Room 1 · Rack D</option>
                    <option value="Room 2 · Rack B">Room 2 · Rack B</option>
                    <option value="Room 3 · Rack A">Room 3 · Rack A</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">Notes (optional)</label>
              <textarea
                placeholder="e.g. picked for Order #SO-8841"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white min-h-[80px]"
              />
            </div>

            <div className="p-3 bg-blue-50/30 border border-blue-100 text-blue-900 text-xs rounded-lg flex gap-2 items-start mt-2">
              <span className="shrink-0 mt-0.5">ℹ️</span>
              <div>
                On save, this movement is cross-checked against the <strong>RFID door entry</strong> and <strong>CCTV sighting</strong> for {scannedProduct.room}, then logged with a match status.
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-between gap-2 mt-2">
              <button
                type="button"
                onClick={handleResetFlow}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
              >
                ← Back to scan
              </button>
              <button
                type="button"
                onClick={handleSaveMovement}
                className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-colors shadow-soft"
              >
                Save movement →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRMATION SCREEN */}
      {step === "confirm" && confirmDetails && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-soft max-w-xl mx-auto w-full animate-fadeIn flex flex-col gap-6 text-center">
          <div className="flex flex-col items-center mt-2">
            <span className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-200 flex items-center justify-center text-3xl font-bold mb-4 shadow-soft">
              ✓
            </span>
            <h2 className="font-display font-bold text-slate-900 text-xl leading-tight">Movement recorded</h2>
            <div className="text-xs text-slate-400 mt-2">
              Logged & cross-checked · Reference <span className="font-mono text-slate-600 font-bold">{confirmDetails.ref}</span>
            </div>
          </div>

          <div className="text-left border-t border-b border-slate-100 py-3 flex flex-col">
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
              <span className="text-slate-400">Product</span>
              <span className="font-semibold text-slate-800 text-right">{confirmDetails.product}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
              <span className="text-slate-400">Movement</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full leading-none uppercase ${
                confirmDetails.type === "IN"
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : confirmDetails.type === "OUT"
                  ? "bg-red-50 text-red-600 border-red-100"
                  : "bg-blue-50 text-blue-600 border-blue-100"
              }`}>
                {confirmDetails.movement}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
              <span className="text-slate-400">From → To</span>
              <span className="font-semibold text-slate-800 text-right text-xs">{confirmDetails.locs}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
              <span className="text-slate-400">Recorded by</span>
              <span className="font-semibold text-slate-800 text-right">{confirmDetails.by}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
              <span className="text-slate-400">Time</span>
              <span className="font-mono font-semibold text-slate-800 text-right">{confirmDetails.time}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
              <span className="text-slate-400">New stock level</span>
              <span className="font-semibold text-slate-800 text-right flex items-center gap-1.5">
                {confirmDetails.newStock}
                <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full leading-none">
                  Low
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 text-sm">
              <span className="text-slate-400">Cross-check</span>
              <div className="flex gap-1.5">
                <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">RFID ✓</span>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">QR ✓</span>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">CCTV ✓</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex gap-2 items-start text-left">
            <span className="shrink-0 mt-0.5">✓</span>
            <div>
              All three signals matched — Vishali tapped the room reader, scanned the QR, and was identified on camera. Movement is <strong>Verified</strong>.
            </div>
          </div>

          <div className="flex gap-2 justify-center mt-2">
            <button
              onClick={handleResetFlow}
              className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-colors shadow-soft"
            >
              ＋ Scan another
            </button>
            <Link
              to="/verification"
              className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
            >
              View in report
            </Link>
          </div>
        </div>
      )}

      <div className="text-slate-400 mt-2 text-center text-[11px]">
        Static mockup fallback loaded when database connection is inactive · Not a real application.
      </div>
    </div>
  );
}
