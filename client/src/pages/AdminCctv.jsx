import { useEffect, useState, useRef } from 'react';
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

function LiveWebcam() {
  const videoRef = useRef(null);
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error("Error accessing webcam:", err));
  }, []);
  
  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      muted 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover', 
        opacity: 0.35, 
        zIndex: 0,
        pointerEvents: 'none'
      }} 
    />
  );
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
        <h2>LIVE FEEDS</h2>
        <div className="camera-grid">
          {/* Entrance IP Camera placeholder */}
          <div className="camera-feed" style={{ position: 'relative', overflow: 'hidden' }}>
            <div className="camera-feed-top" style={{ position: 'relative', zIndex: 1 }}>
              <span className="camera-rec">● REC</span>
              <Clock />
            </div>
            <div className="camera-feed-label" style={{ position: 'relative', zIndex: 1, marginTop: '20px' }}>ENTRANCE (IP CAMERA)</div>
            <div className="camera-feed-sub" style={{ position: 'relative', zIndex: 1, marginTop: '10px' }}>
              <span className="camera-flag">Awaiting IP stream URL</span>
            </div>
          </div>

          {/* Room 1 Webcam */}
          <button className={`camera-feed ${room === 'Room 1' ? 'active' : ''}`} style={{ position: 'relative', overflow: 'hidden' }} onClick={() => setRoom('Room 1')}>
            <LiveWebcam />
            <div className="camera-feed-top" style={{ position: 'relative', zIndex: 1, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              <span className="camera-rec">● REC</span>
              <Clock />
            </div>
            <div className="camera-feed-label" style={{ position: 'relative', zIndex: 1, marginTop: '20px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>ROOM 1 (WEBCAM)</div>
            <div className="camera-feed-sub" style={{ position: 'relative', zIndex: 1, marginTop: '10px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              Live prototype feed
            </div>
          </button>

          {/* Room 2 Dummy */}
          <button className={`camera-feed ${room === 'Room 2' ? 'active' : ''}`} onClick={() => setRoom('Room 2')}>
            <div className="camera-feed-top">
              <span className="camera-rec">● REC</span>
              <Clock />
            </div>
            <div className="camera-feed-label">ROOM 2</div>
            <div className="camera-feed-sub">Feed nominal</div>
          </button>

          {/* Room 3 Dummy */}
          <button className={`camera-feed ${room === 'Room 3' ? 'active' : ''}`} onClick={() => setRoom('Room 3')}>
            <div className="camera-feed-top">
              <span className="camera-rec">● REC</span>
              <Clock />
            </div>
            <div className="camera-feed-label">ROOM 3</div>
            <div className="camera-feed-sub">Feed nominal</div>
          </button>
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
