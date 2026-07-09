import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Upload, ArrowRight, Package, RotateCcw, ScanLine } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { decodeProductQR } from "../utils/qrPayload.js";

const CAMERA_ID = "qr-reader";
const FILE_ID = "qr-reader-file";

const CATEGORY_TONE = {
  Stationery: "primary",
  Books: "info",
  "Office Supplies": "violet",
  Electronics: "success",
  Accessories: "warning",
};

export default function QrScanner() {
  const [mode, setMode] = useState("camera"); // "camera" | "upload"
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const cameraRef = useRef(null);

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

  // Always stop the camera when leaving the page.
  useEffect(() => () => { stopCamera(); }, []);

  const handleDecoded = (text) => {
    try {
      setResult(decodeProductQR(text));
      setError("");
    } catch (e) {
      setResult(null);
      setError(e.message);
    }
  };

  const startCamera = async () => {
    setError("");
    setResult(null);
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
        () => {} // ignore per-frame decode errors
      );
    } catch (e) {
      cameraRef.current = null;
      setScanning(false);
      setError("Could not start camera. Grant camera permission or use Upload.");
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    await stopCamera();
    setError("");
    setResult(null);
    try {
      const inst = new Html5Qrcode(FILE_ID);
      const decoded = await inst.scanFile(file, false);
      await inst.clear();
      handleDecoded(decoded);
    } catch {
      setError("No QR code found in that image.");
    }
  };

  const switchMode = async (next) => {
    if (next === mode) return;
    await stopCamera();
    setMode(next);
  };

  const reset = () => {
    setResult(null);
    setError("");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="QR Scanner" subtitle="Scan a product QR to view its details" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner panel */}
        <div className="card p-6 flex flex-col gap-4">
          <div className="inline-flex self-start rounded-xl bg-hairline/[0.05] p-1">
            <button
              onClick={() => switchMode("camera")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "camera" ? "bg-surface-alt text-ink shadow-soft" : "text-muted"
              }`}
            >
              <Camera size={16} /> Camera
            </button>
            <button
              onClick={() => switchMode("upload")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "upload" ? "bg-surface-alt text-ink shadow-soft" : "text-muted"
              }`}
            >
              <Upload size={16} /> Upload
            </button>
          </div>

          {mode === "camera" ? (
            <div className="flex flex-col gap-3">
              <div className="relative rounded-2xl overflow-hidden bg-black/40 aspect-square max-w-sm mx-auto w-full">
                <div id={CAMERA_ID} className="w-full h-full" />
                {scanning && (
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-0.5 bg-primary/80 shadow-glow animate-scanLine" />
                )}
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
                    <ScanLine size={40} strokeWidth={1.2} className="text-primary/60" />
                    <p className="text-sm">Camera is off</p>
                  </div>
                )}
              </div>
              {scanning ? (
                <button onClick={stopCamera} className="btn-secondary ripple text-sm">Stop Camera</button>
              ) : (
                <button onClick={startCamera} className="btn-primary ripple flex items-center justify-center gap-2 text-sm">
                  <Camera size={16} /> Start Camera
                </button>
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 aspect-square max-w-sm mx-auto w-full rounded-2xl border-2 border-dashed border-hairline/20 cursor-pointer hover:border-primary/40 transition-colors text-muted">
              <Upload size={36} strokeWidth={1.3} className="text-primary/70" />
              <span className="text-sm">Click to upload a QR image</span>
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </label>
          )}

          {/* Hidden container html5-qrcode needs for file decoding. */}
          <div id={FILE_ID} className="hidden" />

          {error && <Badge tone="danger">{error}</Badge>}
        </div>

        {/* Result panel */}
        <div className="card p-6 flex flex-col gap-4">
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 text-muted">
              <Package size={40} strokeWidth={1.2} className="text-primary/60" />
              <p>Scan a product QR to see its details here.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-ink">{result.name}</p>
                  <p className="text-xs text-muted mt-0.5">{result.sku} · Box {result.box}</p>
                </div>
                <Badge tone={CATEGORY_TONE[result.category] || "neutral"}>{result.category}</Badge>
              </div>

              <div className="flex items-center justify-center gap-3 py-3 rounded-xl bg-hairline/[0.04]">
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Origin / Source</p>
                  <Badge tone="info">{result.src || "—"}</Badge>
                </div>
                {result.dst && (
                  <>
                    <ArrowRight size={20} className="text-primary" />
                    <div className="text-center">
                      <p className="text-[11px] uppercase tracking-wide text-muted">Destination</p>
                      <Badge tone="success">{result.dst}</Badge>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                <span className="text-muted">Stock Quantity</span><span className="text-ink text-right font-medium">{result.qty}</span>
                <span className="text-muted">SKU</span><span className="text-ink text-right">{result.sku}</span>
                <span className="text-muted">Box</span><span className="text-ink text-right">{result.box}</span>
                <span className="text-muted">Category</span><span className="text-ink text-right">{result.category}</span>
                {result.min != null && result.max != null && (
                  <>
                    <span className="text-muted">Min / Max</span>
                    <span className="text-ink text-right">{result.min} / {result.max}</span>
                  </>
                )}
              </div>

              <button onClick={reset} className="btn-secondary ripple flex items-center justify-center gap-2 text-sm mt-1">
                <RotateCcw size={15} /> Scan another
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
