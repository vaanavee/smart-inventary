import { useState } from "react";
import { Camera, Cpu, Sliders, Bell, Moon, Sun, Info, Server, Video, DoorOpen, Package, Search } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { CctvTab, EmployeeTab, StockTab, GuidanceTab } from "./Monitoring.jsx";

const MONITORING_TABS = [
  { id: "cctv", label: "CCTV Monitoring", icon: Video },
  { id: "employee", label: "Employee Monitoring", icon: DoorOpen },
  { id: "stock", label: "Stock Monitoring", icon: Package },
  { id: "guidance", label: "Product Guidance", icon: Search },
];

const SETTINGS = [
  {
    icon: Camera,
    tone: "primary",
    title: "Camera",
    desc: "Camera source, resolution, and reconnect behavior are configured via INV_CAMERA_SOURCE, INV_CAMERA_WIDTH, and INV_CAMERA_HEIGHT in backend/config/settings.py.",
  },
  {
    icon: Cpu,
    tone: "violet",
    title: "AI Model",
    desc: "RT-DETR checkpoint and inference device are set via INV_RTDETR_CHECKPOINT and INV_RTDETR_DEVICE. Fine-tuned checkpoints can be swapped in without code changes.",
  },
  {
    icon: Sliders,
    tone: "warning",
    title: "Confidence Threshold",
    desc: "Minimum detection confidence is controlled by INV_RTDETR_CONFIDENCE_THRESHOLD (default 0.5). Lower values increase recall at the cost of false positives.",
  },
  {
    icon: Bell,
    tone: "danger",
    title: "Notifications",
    desc: "Low-stock and mismatch alerts are generated automatically and surfaced on the Home dashboard and Alerts API.",
  },
  {
    icon: Server,
    tone: "success",
    title: "System Information",
    desc: "Backend: FastAPI + SQLite. Detection: RT-DETR (transformers). Frontend: React + Tailwind + Chart.js.",
  },
];

const ICON_BG = {
  primary: "bg-gradient-to-br from-primary to-primary-light",
  violet: "bg-gradient-to-br from-violet to-purple-400",
  warning: "bg-gradient-to-br from-warning to-amber-400",
  danger: "bg-gradient-to-br from-danger to-rose-400",
  info: "bg-gradient-to-br from-info to-sky-400",
  success: "bg-gradient-to-br from-success to-emerald-400",
};

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [monitorTab, setMonitorTab] = useState("cctv");
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="System configuration and preferences" />

      {isAdmin && (
        <div className="card p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-ink mb-1">Monitoring</h3>
            <p className="text-sm text-muted">CCTV, employee tracking, stock, and product guidance in one place</p>
          </div>

          <div className="inline-flex flex-wrap rounded-xl bg-hairline/[0.05] p-1 gap-1 w-fit">
            {MONITORING_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setMonitorTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    monitorTab === t.id ? "bg-surface-alt text-ink shadow-soft" : "text-muted"
                  }`}
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>

          {monitorTab === "cctv" && <CctvTab />}
          {monitorTab === "employee" && <EmployeeTab />}
          {monitorTab === "stock" && <StockTab />}
          {monitorTab === "guidance" && <GuidanceTab />}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 stagger">
        <div className="card card-hover p-6 flex gap-4">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-info to-sky-400 flex items-center justify-center shadow-soft">
            {theme === "dark" ? (
              <Moon size={22} className="text-white" strokeWidth={2} />
            ) : (
              <Sun size={22} className="text-white" strokeWidth={2} />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-ink mb-1">Theme</h3>
            <p className="text-sm text-muted leading-relaxed mb-3">
              Switch between the WisRight light and dark enterprise themes. Your choice is saved on this device.
            </p>
            <div className="inline-flex rounded-xl bg-hairline/[0.05] p-1 gap-1">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  theme === "light" ? "bg-surface-alt text-ink shadow-soft" : "text-muted"
                }`}
              >
                <Sun size={14} /> Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  theme === "dark" ? "bg-surface-alt text-ink shadow-soft" : "text-muted"
                }`}
              >
                <Moon size={14} /> Dark
              </button>
            </div>
          </div>
        </div>

        {SETTINGS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="card card-hover p-6 flex gap-4">
              <div className={`w-12 h-12 shrink-0 rounded-xl ${ICON_BG[s.tone]} flex items-center justify-center shadow-soft`}>
                <Icon size={22} className="text-white" strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-semibold text-ink mb-1">{s.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-6 flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 rounded-xl bg-hairline/[0.04] flex items-center justify-center">
          <Info size={22} className="text-muted" />
        </div>
        <div>
          <h3 className="font-semibold text-ink mb-1">About</h3>
          <p className="text-sm text-muted leading-relaxed">
            WisRight AI Inventory Verification & Stock Monitoring System — real-time product detection,
            counting, and expected-vs-detected verification using RT-DETR. Version 1.0.0.
          </p>
        </div>
      </div>
    </div>
  );
}
