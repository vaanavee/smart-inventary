import { useEffect, useState } from "react";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function Topbar() {
  const [now, setNow] = useState(new Date());
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <header className="sticky top-0 z-10 h-20 px-8 flex items-center justify-between bg-surface-alt/70 backdrop-blur-xl border-b border-hairline/[0.06]">
      <div>
        <h2 className="text-lg font-semibold text-ink">
          {greetingForHour(now.getHours())}, Admin <span className="ml-0.5">👋</span>
        </h2>
        <p className="text-xs text-muted mt-0.5">
          {dateStr} • {timeStr}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            placeholder="Search products, boxes, workers…"
            className="w-72 bg-hairline/[0.03] border border-hairline/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface-alt transition-all"
          />
        </div>

        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-10 h-10 rounded-xl bg-hairline/[0.03] hover:bg-hairline/[0.06] flex items-center justify-center transition-colors"
        >
          {theme === "dark" ? (
            <Sun size={18} className="text-ink" />
          ) : (
            <Moon size={18} className="text-ink" />
          )}
        </button>

        <button className="relative w-10 h-10 rounded-xl bg-hairline/[0.03] hover:bg-hairline/[0.06] flex items-center justify-center transition-colors">
          <Bell size={18} className="text-ink" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
        </button>

        <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-sm cursor-pointer shadow-soft">
          A
        </div>
      </div>
    </header>
  );
}
