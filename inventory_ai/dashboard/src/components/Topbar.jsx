import { useEffect, useRef, useState } from "react";
import { Bell, Moon, Search, Sun, LogOut, Settings as SettingsIcon, AlertTriangle, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function Topbar() {
  const [now, setNow] = useState(new Date());
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState([]);
  const [readAll, setReadAll] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = () => api.get("/alerts?resolved=false&limit=10").then(setAlerts).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  // Close either dropdown when clicking outside it.
  useEffect(() => {
    const onClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });

  const displayName = user?.name || user?.empId || "User";
  const firstName = displayName.split(" ")[0];
  const isAdmin = user?.role === "admin";
  const roleLabel = isAdmin ? "Administrator" : user?.role === "employee" ? "Employee" : "";
  const unread = readAll ? 0 : alerts.length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-10 h-[58px] px-6 flex items-center justify-between bg-surface-alt border-b border-hairline/10">
      <div>
        <h2 className="text-sm font-semibold text-ink">
          {greetingForHour(now.getHours())}, {firstName} <span className="ml-0.5">👋</span>
        </h2>
        <p className="text-xs text-muted mt-0.5">
          {dateStr} • {timeStr}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            placeholder="Search products, boxes, workers…"
            className="w-64 bg-surface border border-hairline/15 rounded-full pl-9 pr-4 py-1.5 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/25 focus:bg-surface-alt transition-all"
          />
        </div>

        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-9 h-9 rounded-full hover:bg-surface flex items-center justify-center transition-colors text-muted"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen((o) => !o)}
            title="Notifications"
            className="relative w-9 h-9 rounded-full hover:bg-surface flex items-center justify-center transition-colors text-muted"
          >
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-semibold flex items-center justify-center border-2 border-surface-alt">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-surface-alt border border-hairline/10 shadow-lift z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-hairline/10">
                <p className="text-sm font-semibold text-ink">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={() => setReadAll(true)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              <ul className="max-h-80 overflow-y-auto">
                {alerts.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-muted">No notifications.</li>
                )}
                {alerts.map((a) => (
                  <li key={a.id} className="flex gap-3 px-4 py-3 border-b border-hairline/[0.04] last:border-0 hover:bg-hairline/[0.02]">
                    <AlertTriangle
                      size={16}
                      className={`shrink-0 mt-0.5 ${a.severity === "critical" ? "text-danger" : "text-warning"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-ink leading-snug">{a.message}</p>
                      <p className="text-[11px] text-muted mt-0.5 capitalize">
                        {a.severity}
                        {a.created_at ? ` • ${new Date(a.created_at).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  setBellOpen(false);
                  navigate("/");
                }}
                className="w-full px-4 py-2.5 text-xs font-medium text-primary hover:bg-hairline/[0.03] transition-colors border-t border-hairline/[0.06]"
              >
                View all on dashboard
              </button>
            </div>
          )}
        </div>

        {/* Profile menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm cursor-pointer"
          >
            {firstName.charAt(0).toUpperCase()}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface-alt border border-hairline/10 shadow-lift z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-hairline/10">
                <p className="text-sm font-medium text-ink truncate">{displayName}</p>
                <p className="text-xs text-muted">{roleLabel}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/settings");
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-hairline/[0.04] transition-colors"
                >
                  <SettingsIcon size={16} className="text-muted" /> Settings
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger/[0.06] transition-colors"
              >
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
