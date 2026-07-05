import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function AdminHome() {
  const [employees, setEmployees] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getEmployees().then(setEmployees).catch((e) => setError(e.message));
    api.getExpiryAlerts().then((data) => setAlerts(data.alerts)).catch(() => {});
  }, []);

  return (
    <>
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
