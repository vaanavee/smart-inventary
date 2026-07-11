const ICON_BG = {
  primary: "bg-gradient-primary",
  success: "bg-gradient-to-br from-success to-emerald-400",
  warning: "bg-gradient-to-br from-warning to-amber-400",
  violet: "bg-gradient-to-br from-violet to-purple-400",
  info: "bg-gradient-to-br from-info to-sky-400",
};

export default function StatCard({ icon: Icon, label, value, sub, tone = "primary", trend }) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${ICON_BG[tone]} flex items-center justify-center`}>
          <Icon size={15} className="text-white" strokeWidth={2.25} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-display font-bold text-ink tracking-tight">{value}</p>
        {trend !== undefined && trend !== null && (
          <span className={`text-xs font-semibold ${trend >= 0 ? "text-success" : "text-danger"}`}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
