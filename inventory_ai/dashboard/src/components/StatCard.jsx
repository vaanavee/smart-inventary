const ICON_BG = {
  primary: "bg-gradient-primary",
  success: "bg-gradient-to-br from-success to-emerald-400",
  warning: "bg-gradient-to-br from-warning to-amber-400",
  violet: "bg-gradient-to-br from-violet to-purple-400",
  info: "bg-gradient-to-br from-info to-sky-400",
};

export default function StatCard({ icon: Icon, label, value, sub, tone = "primary", trend }) {
  return (
    <div className="card card-hover p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`w-11 h-11 rounded-xl ${ICON_BG[tone]} flex items-center justify-center shadow-soft`}>
          <Icon size={20} className="text-white" strokeWidth={2.25} />
        </div>
        {trend !== undefined && trend !== null && (
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              trend >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold text-ink tracking-tight">{value}</p>
        <p className="text-sm text-muted mt-0.5">{label}</p>
      </div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
