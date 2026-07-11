import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Video,
  Boxes,
  ScanLine,
  Package,
  Users,
  Search,
  BarChart3,
  Settings as SettingsIcon,
  QrCode,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from "lucide-react";
import Logo from "./Logo.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const SECTIONS = [
  {
    title: "OVERVIEW",
    links: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "INVENTORY",
    links: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/inventory", label: "Locations", icon: Boxes },
      { to: "/product-search", label: "Product Search", icon: Search },
    ]
  },
  {
    title: "PEOPLE",
    links: [
      { to: "/workers", label: "Employees", icon: Users },
    ]
  },
  {
    title: "OPERATIONS",
    links: [
      { to: "/qr-scanner", label: "QR Scanner", icon: ScanLine },
    ]
  },
  {
    title: "MONITORING",
    links: [
      { to: "/verification", label: "Attendance Match", icon: ScanLine },
    ]
  },
  {
    title: "REPORTS",
    links: [
      { to: "/analytics", label: "Movement Report", icon: BarChart3, adminOnly: true },
      { to: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
    ]
  }
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isMock = window.location.pathname.startsWith("/mock");
  const prefix = isMock ? "/mock" : "";

  const handleLogout = () => {
    logout();
    navigate(isMock ? "/mock/login" : "/login");
  };

  const displayName = user?.name || user?.empId || "User";
  const displayRole = user?.role === "admin" ? "Administrator" : user?.role === "employee" ? "Employee" : "";

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-64"
      } shrink-0 h-screen sticky top-0 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-20`}
    >
      <div className="h-16 flex items-center px-4 border-b border-slate-800">
        <Logo collapsed={collapsed} dark />
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-4 overflow-y-auto">
        {SECTIONS.map((section, idx) => {
          // Filter links in section based on adminOnly and user role
          const visibleLinks = section.links.filter(
            (link) => !link.adminOnly || user?.role === "admin"
          );

          if (visibleLinks.length === 0) return null;

          return (
            <div key={idx} className="flex flex-col gap-0.5">
              {!collapsed && (
                <div className="text-[10px] font-bold text-slate-500 px-3 mt-4 mb-1.5 tracking-wider uppercase">
                  {section.title}
                </div>
              )}
              {visibleLinks.map((link) => {
                const Icon = link.icon;
                const destination = link.to === "/" ? (isMock ? "/mock" : "/") : `${prefix}${link.to}`;
                return (
                  <NavLink
                    key={link.to}
                    to={destination}
                    end={link.to === "/"}
                    title={collapsed ? link.label : undefined}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-slate-800 text-white"
                          : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                      }`
                    }
                  >
                    <Icon size={17} strokeWidth={2.1} className="shrink-0" />
                    {!collapsed && <span className="truncate">{link.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mx-3 mb-3 flex items-center justify-center gap-2 py-2 rounded-lg text-slate-500 hover:bg-slate-800/70 hover:text-slate-200 transition-colors text-xs font-medium"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && "Collapse"}
      </button>

      <div className="border-t border-slate-800 p-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">{displayRole}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Log out"
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-danger transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
