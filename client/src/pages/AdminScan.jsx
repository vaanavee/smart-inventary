import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../api.js';

const ROOMS = ['Room 1', 'Room 2', 'Room 3'];

export default function AdminScan() {
  const [room, setRoom] = useState('Room 1');
  const [tag, setTag] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const [useCamera, setUseCamera] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!useCamera) {
      inputRef.current?.focus();
      return;
    }

    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [useCamera]);

  async function handleScan(code) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await api.scanRfid(code.trim(), room);
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setTag('');
      setBusy(false);
      if (!useCamera) {
        inputRef.current?.focus();
      }
    }
  }

  function onScanSuccess(decodedText, decodedResult) {
    if (scannerRef.current) {
      setUseCamera(false); // Stop camera on successful scan
    }
    handleScan(decodedText);
  }

  function onScanFailure(error) {
    // handle scan failure
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tag.trim()) return;
    await handleScan(tag);
  }

  return (
    <>
      <div className="card">
        <h2>RFID Door Scan</h2>
        <p className="muted">
          Point a USB/handheld RFID reader at this field (it types the tag like a keyboard), or type a tag ID
          manually and press Enter. You can also use your device camera to scan a QR code representation of the tag.
        </p>

        <div className="grid-buttons" style={{ gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', marginBottom: 18 }}>
          {ROOMS.map((r) => (
            <button
              key={r}
              className={`rack-tag ${room === r ? 'active' : ''}`}
              onClick={() => setRoom(r)}
              type="button"
            >
              <span className="rack-letter">{r.replace('Room ', '')}</span>
              <span className="rack-caption">{r}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
          <button 
            className="submit-btn" 
            style={{ width: 'auto', padding: '8px 16px', background: useCamera ? '#dc3545' : '#0d6efd' }} 
            onClick={() => setUseCamera(!useCamera)}
            type="button"
          >
            {useCamera ? 'Stop Camera' : 'Start Camera'}
          </button>
        </div>

        {useCamera && (
          <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto 20px auto' }}></div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
          <input
            ref={inputRef}
            className="scan-input"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Scan or type RFID tag (e.g. RFID1001)"
            autoComplete="off"
            disabled={useCamera}
          />
          <button className="submit-btn" style={{ width: 'auto', padding: '10px 22px' }} disabled={busy || useCamera}>
            Scan
          </button>
        </form>
        {error && <div className="error-text" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      {result && (
        <div className={`card scan-result ${result.action === 'entry' ? 'scan-in' : 'scan-out'}`}>
          <h2>{result.action === 'entry' ? 'Checked In' : 'Checked Out'}</h2>
          <div className="scan-result-name">{result.employee.name}</div>
          <div className="muted">
            {result.employee.emp_id} &middot; {result.employee.department}
          </div>
          {result.action === 'entry' ? (
            <p style={{ marginTop: 12 }}>
              Entered <strong>{result.room}</strong> at <strong>{result.entry_time}</strong>
            </p>
          ) : (
            <p style={{ marginTop: 12 }}>
              Left <strong>{result.room}</strong> at <strong>{result.exit_time}</strong> (in: {result.entry_time},
              duration {result.duration})
            </p>
          )}
        </div>
      )}
    </>
  );
}
