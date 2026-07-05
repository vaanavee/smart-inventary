import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="landing">
      <div className="landing-card">
        <p className="landing-eyebrow">RFID Stock Control · Rooms 1–3 · Racks A–E</p>
        <h1>Smart Inventory Management</h1>
        <p className="muted">Choose a portal to continue</p>
        <div className="big-buttons" style={{ marginTop: 20 }}>
          <Link className="big-button" to="/login">
            Admin Portal
            <span className="sub">Stock, staff &amp; movement log</span>
          </Link>
          <Link className="big-button employee" to="/employee">
            Employee Portal
            <span className="sub">Check current stock</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
