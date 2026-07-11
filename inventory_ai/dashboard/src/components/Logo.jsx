export default function Logo({ collapsed = false, dark = false }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="w-9 h-9 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 100 100" fill="none" className="w-9 h-9" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="22" fill="#E65F2B" />
          <circle cx="36" cy="40" r="7.5" fill="white" />
          <path
            d="M21 54C23.5 49 28 47.5 32 50.5C36 53.5 39 68 47.5 68C53 68 62 55.5 76.5 31.5C68.5 45.5 61.5 59.5 52 59.5C46.5 59.5 42 52.5 37 47.5C31.5 42 24 48.5 21 54Z"
            fill="white"
          />
        </svg>
      </div>
      {!collapsed && (
        <div className="leading-tight whitespace-nowrap">
          <p className="text-[16px] font-semibold tracking-tight">
            <span className={dark ? "text-white" : "text-slate-900"}>Wis</span>
            <span className="text-[#E65F2B]">Right</span>
          </p>
          <p className={`text-[10px] tracking-wider uppercase font-medium -mt-0.5 ${dark ? "text-slate-400" : "text-muted"}`}>
            Inventory
          </p>
        </div>
      )}
    </div>
  );
}
