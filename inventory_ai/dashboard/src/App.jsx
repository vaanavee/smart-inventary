import { Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Home from "./pages/Home.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import Inventory from "./pages/Inventory.jsx";
import Verification from "./pages/Verification.jsx";
import Products from "./pages/Products.jsx";
import ProductSearch from "./pages/ProductSearch.jsx";
import Workers from "./pages/Workers.jsx";
import Analytics from "./pages/Analytics.jsx";
import Settings from "./pages/Settings.jsx";
import QrGenerator from "./pages/QrGenerator.jsx";
import QrScanner from "./pages/QrScanner.jsx";
import Login from "./pages/Login.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-surface bg-gradient-radial-soft">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-8 overflow-x-hidden page-enter">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/live" element={<Monitoring />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/products" element={<Products />} />
            <Route path="/product-search" element={<ProductSearch />} />
            <Route path="/workers" element={<Workers />} />
            <Route path="/history" element={<Navigate to="/verification" replace />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/monitoring" element={<Navigate to="/settings" replace />} />
            <Route path="/qr-generator" element={<QrGenerator />} />
            <Route path="/qr-scanner" element={<QrScanner />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="py-4 px-8 border-t border-hairline/[0.08] text-center text-xs text-muted">
          Designed & Developed by Vishali, Suraj and Vaanavee as part of the WisRight Innovation Internship Program (WR-IIP) held during June-July 2026
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/mock/login" element={user ? <Navigate to="/mock" replace /> : <Login />} />
      <Route path="/mock/*" element={user ? <AppLayout /> : <Navigate to="/mock/login" replace />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={user ? <AppLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
