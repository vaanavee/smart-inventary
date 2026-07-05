import { useEffect, useState } from 'react';
import { api } from '../api.js';

const ROOMS = ['Room 1', 'Room 2', 'Room 3'];
const RACKS = ['A', 'B', 'C', 'D', 'E'];
const ROOM_LABELS = { 'Room 1': 'Stationery', 'Room 2': 'Craft Materials', 'Room 3': 'Decoration' };

function StatusBadge({ status }) {
  const cls = status === 'Completed' ? 'badge-completed' : 'badge-progress';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function AdminStock() {
  const [overview, setOverview] = useState([]);
  const [room, setRoom] = useState(null);
  const [rack, setRack] = useState(null);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});
  const [customDate, setCustomDate] = useState('');
  const [activeDate, setActiveDate] = useState(null);

  useEffect(() => {
    api.getProductOverview().then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    if (room && rack) {
      api.getProducts(room, rack).then(setProducts).catch(() => {});
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, rack]);

  function loadSummary(date) {
    api
      .getMovementSummary(room, rack, date)
      .then((data) => {
        setSummary(data);
        setActiveDate(date || null);
      })
      .catch(() => {});
  }

  function handleCustomDate(e) {
    e.preventDefault();
    if (customDate) loadSummary(customDate);
  }

  const rackInfo = (r, rk) => overview.find((o) => o.room === r)?.racks.find((x) => x.rack === rk);

  return (
    <>
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
              <button key={r} className="big-button" onClick={() => setRoom(r)}>
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
                <button key={rk} className="rack-tag" onClick={() => setRack(rk)}>
                  <span className="rack-letter">{rk}</span>
                  <span className="rack-caption">{info ? `${info.productCount} SKU · ${info.totalQty} units` : ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {room && rack && (
        <>
          <div className="card">
            <h2>Products in {room} — Rack {rack}</h2>
            <p className="muted">{products.length} product type(s)</p>
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

          <div className="card">
            <h2>Product In / Out Movement</h2>
            <form onSubmit={handleCustomDate} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              <button className="submit-btn" style={{ width: 'auto', padding: '8px 16px' }}>View Date</button>
            </form>

            {Object.keys(summary)
              .sort()
              .map((date) => (
                <div key={date} style={{ marginBottom: 18 }}>
                  <strong>{date}{activeDate === date ? '' : ''}</strong>
                  {summary[date].length === 0 ? (
                    <p className="muted">No movement recorded.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Action</th>
                          <th>Employee</th>
                          <th>In Time</th>
                          <th>Out Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary[date].map((m, i) => (
                          <tr key={i}>
                            <td>{m.product_name}</td>
                            <td>{m.action}</td>
                            <td>{m.employee_name}</td>
                            <td>{m.entry_time || '--'}</td>
                            <td>{m.exit_time || '--'}</td>
                            <td><StatusBadge status={m.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </>
  );
}
