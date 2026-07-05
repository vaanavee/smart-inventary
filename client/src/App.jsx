import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import AdminLayout from './pages/AdminLayout.jsx';
import AdminHome from './pages/AdminHome.jsx';
import AdminStock from './pages/AdminStock.jsx';
import AdminDates from './pages/AdminDates.jsx';
import EmployeeStock from './pages/EmployeeStock.jsx';
import { getToken } from './api.js';

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="stock" element={<AdminStock />} />
        <Route path="dates" element={<AdminDates />} />
      </Route>
      <Route path="/employee" element={<EmployeeStock />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
