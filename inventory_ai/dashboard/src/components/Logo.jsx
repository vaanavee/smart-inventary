export default function Logo({ collapsed = false }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
          <p className="text-[15px] font-semibold text-ink">WisRight</p>
          <p className="text-[11px] text-muted -mt-0.5">Inventory</p>
        </div>
      )}
    </div>
  );
}
