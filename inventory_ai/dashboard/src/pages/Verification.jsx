import { useEffect, useState } from "react";
import { ScanLine, CheckCircle2, XCircle, Loader2, PackageSearch } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";

const STATUS_TONE = {
  VERIFIED: "success",
  WRONG_PRODUCT: "danger",
  MISSING_PRODUCT: "warning",
  EXTRA_PRODUCT: "info",
  UNEXPECTED_PRODUCT: "violet",
  MIXED_PRODUCTS: "violet",
};

const STEPS = ["Scan Box ID", "Select Worker", "Capture Frame", "Run RT-DETR", "Compare & Verify"];

export default function Verification() {
  const [boxId, setBoxId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workers, setWorkers] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get("/workers").then(setWorkers).catch(() => {});
    api.get("/history?limit=6").then(setRecent).catch(() => {});
  }, []);

  const runVerification = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await api.post("/verify", { box_id: boxId, worker_id: Number(workerId) });
      setResult(data);
      api.get("/history?limit=6").then(setRecent).catch(() => {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const activeStep = !boxId ? 0 : !workerId ? 1 : loading ? 3 : result ? 4 : 2;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Box Verification" subtitle="Scan a box to verify product and quantity against expected inventory" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card p-8 flex flex-col items-center gap-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-radial-soft pointer-events-none" />

          <div className="relative w-full max-w-md flex flex-col gap-4 z-10">
            <label className="text-sm font-medium text-ink">
              Box ID
              <div className="relative mt-1.5">
                <PackageSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={boxId}
                  onChange={(e) => setBoxId(e.target.value)}
                  placeholder="e.g. B001"
                  className="input-field pl-11 text-base py-3.5"
                />
              </div>
            </label>

            <label className="text-sm font-medium text-ink">
              Worker
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className="input-field mt-1.5 py-3.5"
              >
                <option value="">Select worker</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.department}
                  </option>
                ))}
              </select>
            </label>

            <div
              className={`relative mt-2 rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 transition-colors ${
                loading ? "border-primary bg-primary/[0.04]" : "border-hairline/10"
              }`}
            >
              {loading && (
                <div className="absolute inset-x-4 top-4 h-0.5 bg-gradient-primary rounded-full animate-scanLine" />
              )}
              <ScanLine size={40} className={loading ? "text-primary animate-pulse" : "text-muted"} strokeWidth={1.5} />
              <p className="text-xs text-muted text-center">
                {loading ? "Capturing frame & running RT-DETR…" : "Ready to scan verification tray"}
              </p>
            </div>

            <button
              onClick={runVerification}
              disabled={!boxId || !workerId || loading}
              className="btn-primary ripple flex items-center justify-center gap-2 text-base py-3.5"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
              {loading ? "Verifying…" : "Scan & Verify"}
            </button>

            {error && <p className="text-sm text-danger text-center">{error}</p>}
          </div>

          {result && (
            <div className="relative z-10 w-full max-w-md card !shadow-none border border-hairline/[0.06] p-5 animate-slideUp">
              <div className="flex items-center gap-2 mb-2">
                {result.status === "VERIFIED" ? (
                  <CheckCircle2 size={20} className="text-success" />
                ) : (
                  <XCircle size={20} className="text-danger" />
                )}
                <Badge tone={STATUS_TONE[result.status] || "neutral"}>{result.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="text-sm text-muted">{result.details}</p>
              <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                <div>
                  <p className="text-muted mb-1 font-medium">Expected</p>
                  <pre className="bg-hairline/[0.03] rounded-lg p-2.5 overflow-x-auto">{JSON.stringify(result.expected, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-muted mb-1 font-medium">Detected</p>
                  <pre className="bg-hairline/[0.03] rounded-lg p-2.5 overflow-x-auto">{JSON.stringify(result.detected, null, 2)}</pre>
                </div>
              </div>
              <p className="text-xs text-muted mt-3">
                Confidence: {(result.confidence * 100).toFixed(0)}% • Transaction #{result.transaction_id}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-4">Verification Steps</h3>
            <ol className="flex flex-col gap-4">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      i < activeStep
                        ? "bg-success text-white"
                        : i === activeStep
                        ? "bg-gradient-primary text-white"
                        : "bg-hairline/[0.06] text-muted"
                    }`}
                  >
                    {i < activeStep ? <CheckCircle2 size={14} /> : i + 1}
                  </span>
                  <span className={`text-sm ${i <= activeStep ? "text-ink font-medium" : "text-muted"}`}>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-4">Recent Verifications</h3>
            <ul className="flex flex-col divide-y divide-hairline/[0.05]">
              {recent.map((t) => (
                <li key={t.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="text-muted">#{t.id}</span>
                  <Badge tone={STATUS_TONE[t.verification_status] || "neutral"}>
                    {t.verification_status.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
              {recent.length === 0 && <li className="py-2.5 text-sm text-muted">No verifications yet.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
