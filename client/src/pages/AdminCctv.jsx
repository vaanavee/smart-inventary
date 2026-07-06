import { useEffect, useState } from 'react';
import { api } from '../api.js';

const ROOMS = ['Room 1', 'Room 2', 'Room 3'];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="camera-clock">{now.toLocaleTimeString('en-GB')}</span>;
}

export default function AdminCctv() {
  const [cameras, setCameras] = useState([]);
  const [room, setRoom] = useState('Room 1');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCctvOverview().then((data) => setCameras(data.cameras)).catch((e) => setError(e.message));
  }, []);

  const racksForRoom = cameras.filter((c) => c.room === room);
  const mismatchCount = cameras.filter((c) => c.status === 'mismatch').length;

  return (
    <>
      <div className="card">
        <h2>CCTV Monitoring</h2>
        <p className="muted">
          Feeds are currently monitored by <strong>RT-DETRv2</strong> (Product Counting) and <strong>YOLOv8</strong> (Employee Tracking).
          Detected personnel are cross-referenced with RFID logs for real-time identification.
        </p>
        {error && <div className="error-text">{error}</div>}
        {mismatchCount > 0 && (
          <div className="alert-banner" style={{ marginTop: 14 }}>
            <strong>⚠ {mismatchCount} rack(s) flagged with a count mismatch</strong>
            <div>Camera-detected count differs from the recorded quantity — worth a manual check.</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="camera-grid">
          {ROOMS.map((r) => {
            const roomCameras = cameras.filter((c) => c.room === r);
            const roomMismatch = roomCameras.some((c) => c.status === 'mismatch');
            const identifiedEmployee = roomCameras.length > 0 ? roomCameras[0].identifiedEmployee : null;

            return (
              <button key={r} className={`camera-feed ${room === r ? 'active' : ''}`} onClick={() => setRoom(r)}>
                <div className="camera-feed-top">
                  <span className="camera-rec">● REC</span>
                  <Clock />
                </div>
                <div className="camera-feed-label">{r}</div>
                <div className="camera-feed-sub">
                  {roomMismatch ? <span className="camera-flag">Discrepancy flagged</span> : 'Feed nominal'}
                </div>
                {identifiedEmployee && (
                  <div style={{ marginTop: '8px', fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', color: '#4ade80' }}>
                    <strong>YOLO ID:</strong> {identifiedEmployee}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>{room} — Rack Cameras</h2>
        <div className="grid-buttons" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {racksForRoom.map((cam) => (
            <div key={cam.rack} className={`rack-cam ${cam.status === 'mismatch' ? 'rack-cam-mismatch' : ''}`}>
              <div className="rack-cam-head">
                <span className="rack-letter">{cam.rack}</span>
                <span className={`badge ${cam.status === 'match' ? 'badge-completed' : 'badge-progress'}`}>
                  {cam.status === 'match' ? 'Match' : 'Mismatch'}
                </span>
              </div>
              <div className="rack-cam-counts">
                <div>
                  <span className="rack-cam-num">{cam.aiCount}</span>
                  <span className="muted"> AI count</span>
                </div>
                <div>
                  <span className="rack-cam-num">{cam.recordedQty}</span>
                  <span className="muted"> recorded</span>
                </div>
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {cam.lastActivity
                  ? `Last scan: ${cam.lastActivity.employee_name} ${cam.lastActivity.action.toLowerCase()} ${cam.lastActivity.product_name} at ${cam.lastActivity.entry_time} (${cam.lastActivity.date})`
                  : 'No scans recorded'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
