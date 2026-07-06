const TONES = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  violet: "bg-violet/10 text-violet",
  primary: "bg-primary/10 text-primary",
  neutral: "bg-black/5 text-muted",
};

export default function Badge({ tone = "neutral", children, dot = false }) {
  return (
    <span className={`badge ${TONES[tone] || TONES.neutral}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${TONES[tone].split(" ")[1]} bg-current`} />}
      {children}
    </span>
  );
}
