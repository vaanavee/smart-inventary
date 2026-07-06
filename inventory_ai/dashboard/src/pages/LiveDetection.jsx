import { useEffect, useRef, useState } from "react";
import { Play, Square, Gauge, ScanEye, Percent, UserCheck } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";

export default function LiveDetection() {
  const [status, setStatus] = useState(null);
  const [detections, setDetections] = useState([]);
  const [counts, setCounts] = useState({});
  const pollRef = useRef(null);

  const refresh = () => {
    api
      .get("/live/detections")
      .then((data) => {
        setStatus(data.camera);
        setDetections(data.detections);
        setCounts(data.counts);
      })
      .catch(() => {});
  };

  useEffect(() => {
    api.get("/live/status").then(setStatus).catch(() => {});
    pollRef.current = setInterval(refresh, 1500);
    return () => clearInterval(pollRef.current);
  }, []);

  const start = () => api.post("/live/start", {}).then(setStatus);
  const stop = () => api.post("/live/stop", {}).then(setStatus);

  const isLive = !!status?.connected;
  const topConfidence = detections.length
    ? Math.max(...detections.map((d) => d.confidence)) * 100
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Live Detection"
        subtitle="Real-time RT-DETR product detection from the verification tray camera"
        actions={
          <>
            <button onClick={start} className="btn-secondary ripple flex items-center gap-2 !py-2 !px-4 text-sm">
              <Play size={16} /> Start Webcam
            </button>
            <button
              onClick={stop}
              className="ripple flex items-center gap-2 !py-2 !px-4 text-sm rounded-xl bg-danger/10 text-danger font-medium hover:bg-danger/20 transition-colors"
            >
              <Square size={16} /> Stop Webcam
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          <div
            className={`relative rounded-2xl overflow-hidden bg-black transition-shadow duration-500 ${
              isLive ? "shadow-glow animate-pulseGlow" : "shadow-soft"
            }`}
          >
            <img src="/api/live/stream" alt="live camera feed" className="w-full h-auto block" />
            {isLive && (
              <span className="absolute top-4 left-4 flex items-center gap-1.5 bg-danger text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            )}
            <span className="absolute top-4 right-4 bg-black/50 backdrop-blur text-white text-xs font-medium px-3 py-1.5 rounded-full">
              {status?.fps ?? 0} FPS
            </span>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-4">Recent Detection Timeline</h3>
            <ul className="flex flex-col gap-3 max-h-64 overflow-y-auto">
              {detections.map((d, i) => (
                <li key={i} className="flex items-center justify-between text-sm border-b border-black/[0.05] pb-3 last:border-0">
                  <span className="text-ink font-medium">{d.name}</span>
                  <Badge tone={d.confidence > 0.7 ? "success" : "warning"}>
                    {(d.confidence * 100).toFixed(1)}%
                  </Badge>
                </li>
              ))}
              {detections.length === 0 && (
                <li className="text-sm text-muted py-6 text-center">No detections yet. Start the webcam to begin.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-violet/10 flex items-center justify-center">
                <ScanEye size={18} className="text-violet" />
              </div>
              <p className="text-xs text-muted">Detection Status</p>
              <p className={`text-sm font-semibold ${isLive ? "text-success" : "text-danger"}`}>
                {isLive ? "Connected" : "Disconnected"}
              </p>
            </div>
            <div className="card p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Gauge size={18} className="text-primary" />
              </div>
              <p className="text-xs text-muted">FPS</p>
              <p className="text-sm font-semibold text-ink">{status?.fps ?? 0}</p>
            </div>
            <div className="card p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
                <Percent size={18} className="text-info" />
              </div>
              <p className="text-xs text-muted">Top Confidence</p>
              <p className="text-sm font-semibold text-ink">{topConfidence.toFixed(0)}%</p>
            </div>
            <div className="card p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                <UserCheck size={18} className="text-success" />
              </div>
              <p className="text-xs text-muted">Current Worker</p>
              <p className="text-sm font-semibold text-ink truncate">{status?.source ?? "—"}</p>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-ink mb-3 text-sm">Detected Products</h3>
            <ul className="flex flex-col divide-y divide-black/[0.05]">
              {Object.entries(counts).map(([name, count]) => (
                <li key={name} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="text-ink">{name}</span>
                  <span className="font-semibold text-primary">{count}</span>
                </li>
              ))}
              {Object.keys(counts).length === 0 && (
                <li className="py-2.5 text-sm text-muted">No detections yet.</li>
              )}
            </ul>
          </div>

          {status?.last_error && (
            <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger">
              {status.last_error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
