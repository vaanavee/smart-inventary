import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function EmployeeScan() {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef(null);

  const [useCamera, setUseCamera] = useState(false);

  useEffect(() => {
    if (!useCamera) return;

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

  async function handleProductCode(code) {
    if (busy) return;
    setBusy(true);
    setError('');
    setScanResult(null);

    try {
      const data = await api.getProductById(code);
      setScanResult(data);
    } catch (err) {
      setError(err.message || 'Product not found');
    } finally {
      setBusy(false);
    }
  }

  function onScanSuccess(decodedText, decodedResult) {
    // Handle the scanned code as you like, for example:
    if (scannerRef.current) {
      // optional: pause or clear scanner on success
      // scannerRef.current.clear();
      setUseCamera(false); // Stop camera on successful scan
    }
    handleProductCode(decodedText);
  }

  function onScanFailure(error) {
    // handle scan failure, usually better to ignore and keep scanning
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCode.trim()) {
      handleProductCode(manualCode.trim());
      setManualCode('');
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar employee">
        <h1>Scan Product</h1>
        <nav>
          <Link to="/employee">Back to Stock</Link>
          <ThemeToggle />
          <Link to="/">Exit</Link>
        </nav>
      </div>
      <div className="container">
        <div className="card">
          <h2>Product Scanner</h2>
          <p className="muted">
            Enter the Product ID below, or use your device camera to scan a QR code.
          </p>
          
          <div style={{ display: 'flex', gap: 10, marginTop: 15, marginBottom: 15 }}>
            <button 
              className="submit-btn" 
              style={{ width: 'auto', padding: '8px 16px', background: useCamera ? '#dc3545' : '#0d6efd' }} 
              onClick={() => setUseCamera(!useCamera)}
            >
              {useCamera ? 'Stop Camera' : 'Start Camera'}
            </button>
          </div>

          {useCamera && (
            <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '20px auto' }}></div>
          )}

          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <input
              className="scan-input"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. ST001"
              autoComplete="off"
            />
            <button className="submit-btn" style={{ width: 'auto', padding: '10px 22px' }} disabled={busy}>
              Search
            </button>
          </form>

          {error && <div className="error-text" style={{ marginTop: 14 }}>{error}</div>}
        </div>

        {scanResult && (
          <div className="card scan-result scan-in">
            <h2>Product Found</h2>
            <div className="scan-result-name">{scanResult.name}</div>
            <div className="muted">
              ID: {scanResult.product_id} &middot; Qty: {scanResult.qty} {scanResult.unit}
            </div>
            <p style={{ marginTop: 12, fontSize: '1.2em' }}>
              Place at <strong>{scanResult.room}</strong> — <strong>Rack {scanResult.rack}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
