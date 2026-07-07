import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

const ROOMS = ['Room 1', 'Room 2', 'Room 3'];
const RACKS = ['A', 'B', 'C', 'D', 'E'];
const ROOM_LABELS = { 'Room 1': 'Stationery', 'Room 2': 'Craft Materials', 'Room 3': 'Decoration' };

export default function EmployeeStock() {
  const [overview, setOverview] = useState([]);
  const [room, setRoom] = useState(null);
  const [rack, setRack] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.getProductOverview().then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    if (room && rack) api.getProducts(room, rack).then(setProducts).catch(() => {});
  }, [room, rack]);

  const rackInfo = (r, rk) => overview.find((o) => o.room === r)?.racks.find((x) => x.rack === rk);

  return (
    <div className="app-shell">
      <div className="topbar employee">
        <h1>Smart Inventory — Employee</h1>
        <nav>
          <Link to="/employee/scan">Scan Product</Link>
          <ThemeToggle />
          <Link to="/">Exit</Link>
        </nav>
      </div>
      <div className="container">
        <div className="breadcrumb">
          <button onClick={() => { setRoom(null); setRack(null); }}>Stock</button>
          {room && <> / <button onClick={() => setRack(null)}>{room}</button></>}
          {rack && <> / Rack {rack}</>}
        </div>

        {!room && (
          <div className="card">
            <h2>Select a Room</h2>
            <div className="big-buttons">
              {ROOMS.map((r) => (
                <button key={r} className="big-button employee" onClick={() => setRoom(r)}>
                  {r}
                  <span className="sub">{ROOM_LABELS[r]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {room && !rack && (
          <div className="card">
            <h2>{room} — Select a Rack</h2>
            <div className="grid-buttons">
              {RACKS.map((rk) => {
                const info = rackInfo(room, rk);
                return (
                  <button key={rk} className="rack-tag employee" onClick={() => setRack(rk)}>
                    <span className="rack-letter">{rk}</span>
                    <span className="rack-caption">{info ? `${info.productCount} SKU · ${info.totalQty} units` : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {room && rack && (
          <div className="card">
            <h2>Products in {room} — Rack {rack}</h2>
            <table>
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id}>
                    <td>{p.product_id}</td>
                    <td>{p.name}</td>
                    <td>{p.unit}</td>
                    <td>{p.qty}</td>
                    <td>{p.expiry_date || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
