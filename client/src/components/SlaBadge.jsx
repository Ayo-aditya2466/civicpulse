import { slaFor, formatRemaining } from "../lib/sla";

// Deterministic SLA pill. All arithmetic comes from lib/sla.js; this only maps
// the computed level to colors/label.
const STYLES = {
  overdue: "bg-red-100 text-red-700 border-red-200",
  "due-soon": "bg-amber-100 text-amber-800 border-amber-200",
  "on-track": "bg-emerald-100 text-emerald-700 border-emerald-200",
  resolved: "bg-slate-100 text-slate-500 border-slate-200",
};

const LABELS = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  "on-track": "On track",
  resolved: "Closed",
};

export default function SlaBadge({ complaint, showRemaining = true }) {
  const { level, remainingMs } = slaFor(complaint);
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium " +
        STYLES[level]
      }
    >
      {LABELS[level]}
      {showRemaining && level !== "resolved" && (
        <span className="font-normal opacity-80">
          · {formatRemaining(remainingMs)}
        </span>
      )}
    </span>
  );
}
