const TONES = {
  primary: "bg-gradient-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export default function ProgressBar({ value, max = 100, tone = "primary", height = "h-1.5" }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={`w-full ${height} bg-hairline/10 rounded-full overflow-hidden`}>
      <div
        className={`${height} ${TONES[tone]} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
