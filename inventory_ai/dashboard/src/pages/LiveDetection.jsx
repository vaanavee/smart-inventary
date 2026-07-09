import { useEffect, useRef, useState } from "react";
import { Play, Square, Gauge, ScanEye, Percent, UserCheck, VideoOff } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Badge from "../components/Badge.jsx";
import { api } from "../api/client.js";

// How often to send a frame to the backend for detection. RT-DETR inference on
// CPU is slow, so we keep this modest and never send a new frame while one is
// still being processed (see inFlight guard).
const DETECT_INTERVAL_MS = 1200;

export default function LiveDetection() {
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [detections, setDetections] = useState([]);
  const [counts, setCounts] = useState({});
  const [fps, setFps] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const inFlight = useRef(false);

  async function captureAndDetect() {
    if (inFlight.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const image = canvas.toDataURL("image/jpeg", 0.6);

    inFlight.current = true;
    try {
      const data = await api.post("/live/detect-frame", { image });
      setDetections(data.detections || []);
      setCounts(data.counts || {});
    } catch {
      /* transient network/inference error — keep the last result */
    } finally {
      inFlight.current = false;
    }
  }

  async function start() {
    if (starting || live) return;
    setError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const settings = stream.getVideoTracks()[0]?.getSettings?.() || {};
      setFps(Math.round(settings.frameRate || 0));
      setLive(true);
      timerRef.current = setInterval(captureAndDetect, DETECT_INTERVAL_MS);
    } catch {
      setError("Could not access the camera. Allow camera permission in your browser and use HTTPS/localhost.");
    } finally {
      setStarting(false);
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
    setDetections([]);
    setCounts({});
    setFps(0);
  }

  // Stop the camera when leaving the page.
  useEffect(() => () => stop(), []);

  const topConfidence = detections.length ? Math.max(...detections.map((d) => d.confidence)) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Live Detection"
        subtitle="Real-time RT-DETR product detection from your device camera"
        actions={
          <>
            <button
              onClick={start}
              disabled={starting || live}
              className="btn-secondary ripple flex items-center gap-2 !py-2 !px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} /> {starting ? "Starting…" : "Start Webcam"}
            </button>
            <button
              onClick={stop}
              disabled={!live}
              className="ripple flex items-center gap-2 !py-2 !px-4 text-sm rounded-xl bg-danger/10 text-danger font-medium hover:bg-danger/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              live ? "shadow-glow animate-pulseGlow" : "shadow-soft"
            }`}
          >
            {/* Video is always mounted so the ref exists; hidden until live. */}
            <video
              ref={videoRef}
              muted
              playsInline
              className={`w-full h-auto block ${live ? "" : "hidden"}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            {!live && (
              <div className="aspect-video flex flex-col items-center justify-center gap-3 text-muted">
                <VideoOff size={40} strokeWidth={1.2} className="text-danger/70" />
                <p className="text-sm">Camera is off — press "Start Webcam" to begin.</p>
              </div>
            )}
            {live && (
              <span className="absolute top-4 left-4 flex items-center gap-1.5 bg-danger text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            )}
            {live && (
              <span className="absolute top-4 right-4 bg-black/50 backdrop-blur text-white text-xs font-medium px-3 py-1.5 rounded-full">
                {fps} FPS
              </span>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-4">Recent Detection Timeline</h3>
            <ul className="flex flex-col gap-3 max-h-64 overflow-y-auto">
              {detections.map((d, i) => (
                <li key={i} className="flex items-center justify-between text-sm border-b border-hairline/[0.05] pb-3 last:border-0">
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
              <p className={`text-sm font-semibold ${live ? "text-success" : starting ? "text-warning" : "text-danger"}`}>
                {live ? "Connected" : starting ? "Connecting…" : "Disconnected"}
              </p>
            </div>
            <div className="card p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Gauge size={18} className="text-primary" />
              </div>
              <p className="text-xs text-muted">FPS</p>
              <p className="text-sm font-semibold text-ink">{fps}</p>
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
              <p className="text-xs text-muted">Source</p>
              <p className="text-sm font-semibold text-ink truncate">{live ? "Browser camera" : "—"}</p>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-ink mb-3 text-sm">Detected Products</h3>
            <ul className="flex flex-col divide-y divide-hairline/[0.05]">
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

          {error && (
            <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
