import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function AdminHome() {
  const [employees, setEmployees] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [inBuilding, setInBuilding] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');

  function loadCurrent() {
    api.getCurrentRoomEntries().then(setInBuilding).catch(() => {});
  }

  useEffect(() => {
    api.getEmployees().then(setEmployees).catch((e) => setError(e.message));
    api.getExpiryAlerts().then((data) => setAlerts(data.alerts)).catch(() => {});
    loadCurrent();

    // Real-time push via SSE; a slow poll stays as a safety net in case the
    // stream drops (e.g. proxy/network hiccup) so the table never goes stale.
    const pollId = setInterval(loadCurrent, 30000);

    const source = new EventSource(api.roomEntryStreamUrl());
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = (evt) => {
      const payload = JSON.parse(evt.data);
      if (payload.action === 'entry' || payload.action === 'exit') {
        setLiveEvents((prev) => [{ ...payload, id: `${payload.employee.emp_id}-${Date.now()}` }, ...prev].slice(0, 20));
        loadCurrent();
      }
    };

    return () => {
      clearInterval(pollId);
      source.close();
    };
  }, []);

  return (
    <>
      <div className="card">
        <h2>
          Live RFID Feed{' '}
          <span style={{ fontSize: '0.7em', color: live ? '#16a34a' : '#dc2626' }}>
            {live ? '● Live' : '○ Reconnecting…'}
          </span>
        </h2>
        {liveEvents.length === 0 ? (
          <p className="muted">Waiting for the next RFID scan…</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {liveEvents.map((e) => (
              <li key={e.id}>
                {e.action === 'entry'
                  ? `${e.employee.name} (${e.employee.emp_id}) entered ${e.room} at ${e.entry_time}`
                  : `${e.employee.name} (${e.employee.emp_id}) exited ${e.room} at ${e.exit_time} (${e.duration})`}
              </li>
            ))}
          </ul>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="alert-banner">
          <strong>⚠ Expiry Notification — {alerts.length} product(s) approaching expiry</strong>
          {alerts.map((a) => (
            <div key={a.product_id}>
              {a.name} ({a.product_id}) — Room {a.room.replace('Room ', '')} / Rack {a.rack} — expires {a.expiry_date}
              {a.expired ? ' (EXPIRED)' : ''}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Currently In Building ({inBuilding.length})</h2>
        {inBuilding.length === 0 ? (
          <p className="muted">No one is currently checked in. Scan an RFID tag at a door to check in.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Emp ID</th>
                <th>RFID Tag</th>
                <th>Room</th>
                <th>Entered At</th>
              </tr>
            </thead>
            <tbody>
              {inBuilding.map((r) => (
                <tr key={r.emp_id + r.entry_time}>
                  <td>{r.employee_name}</td>
                  <td>{r.emp_id}</td>
                  <td>{r.rfid_tag}</td>
                  <td>{r.room}</td>
                  <td>{r.entry_time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Employee Details</h2>
        {error && <div className="error-text">{error}</div>}
        <table>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Employee ID</th>
              <th>RFID Tag ID</th>
              <th>Department</th>
              <th>Shift</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.emp_id}>
                <td>{e.name}</td>
                <td>{e.emp_id}</td>
                <td>{e.rfid_tag}</td>
                <td>{e.department}</td>
                <td>{e.shift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Stock Monitoring</h2>
        <div className="big-buttons">
          <Link className="big-button" to="/admin/stock">
            Stock
            <span className="sub">Rooms, racks &amp; quantities</span>
          </Link>
          <Link className="big-button secondary" to="/admin/dates">
            Date
            <span className="sub">RFID movement log</span>
          </Link>
        </div>
      </div>
    </>
  );
}
