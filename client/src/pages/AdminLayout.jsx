import { Outlet, Link, useNavigate } from 'react-router-dom';
import { clearToken } from '../api.js';

export default function AdminLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <h1>Smart Inventory — Admin</h1>
        <nav>
          <Link to="/admin">Home</Link>
          <Link to="/admin/stock">Stock</Link>
          <Link to="/admin/dates">Date</Link>
          <button onClick={handleLogout}>Logout</button>
        </nav>
      </div>
      <div className="container">
        <Outlet />
      </div>
    </div>
  );
}
