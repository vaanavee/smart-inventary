import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Video,
  Boxes,
  ScanLine,
  Package,
  Users,
  History as HistoryIcon,
  BarChart3,
  Settings as SettingsIcon,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Logo from "./Logo.jsx";

const LINKS = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/live", label: "Live Detection", icon: Video },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/verification", label: "Verification", icon: ScanLine },
  { to: "/products", label: "Products", icon: Package },
  { to: "/workers", label: "Workers", icon: Users },
  { to: "/history", label: "History", icon: HistoryIcon },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-64"
      } shrink-0 h-screen sticky top-0 bg-surface-alt border-r border-hairline/[0.06] flex flex-col transition-all duration-300 z-20`}
    >
      <div className="h-20 flex items-center px-5 border-b border-hairline/[0.06]">
        <Logo collapsed={collapsed} />
      </div>

      <nav className="flex-1 flex flex-col gap-1.5 px-3 py-5 overflow-y-auto">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              title={collapsed ? link.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-primary text-white shadow-soft"
                    : "text-muted hover:bg-hairline/[0.04] hover:text-ink"
                }`
              }
            >
              <Icon size={19} strokeWidth={2.1} className="shrink-0" />
              {!collapsed && <span className="truncate">{link.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mx-3 mb-3 flex items-center justify-center gap-2 py-2 rounded-xl text-muted hover:bg-hairline/[0.04] hover:text-ink transition-colors text-xs font-medium"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && "Collapse"}
      </button>

      <div className="border-t border-hairline/[0.06] p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-sm shrink-0">
            A
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">Admin</p>
              <p className="text-xs text-muted truncate">Warehouse Manager</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
