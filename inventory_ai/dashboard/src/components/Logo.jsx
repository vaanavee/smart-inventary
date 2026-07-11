export default function Logo({ collapsed = false, dark = false }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="w-8 h-8 shrink-0 rounded-lg bg-primary flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12L10 18L20 6"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {!collapsed && (
        <div className="leading-tight whitespace-nowrap">
          <p className={`text-[15px] font-display font-semibold ${dark ? "text-white" : "text-ink"}`}>WisRight</p>
          <p className={`text-[11px] -mt-0.5 ${dark ? "text-slate-400" : "text-muted"}`}>Inventory</p>
        </div>
      )}
    </div>
  );
}
