import { STATUS_FLOW } from "../config";
import { Check } from "lucide-react";

function fmt(at) {
  if (!at) return null;
  return new Date(at).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Vertical stepper for Submitted → Assigned → In Progress → Resolved.
// `history` (optional) supplies per-step timestamps.
export default function StatusTimeline({ status, history = [] }) {
  const currentIndex = STATUS_FLOW.indexOf(status);
  const timeFor = (s) => fmt(history.find((h) => h.status === s)?.at);

  return (
    <ol className="space-y-0">
      {STATUS_FLOW.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const reached = done || active;
        const isLast = i === STATUS_FLOW.length - 1;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
                  (reached
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-400")
                }
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              {!isLast && (
                <span
                  className={
                    "my-1 w-px flex-1 " +
                    (done ? "bg-slate-900" : "bg-slate-200")
                  }
                  style={{ minHeight: 20 }}
                />
              )}
            </div>
            <div className="pb-4">
              <div
                className={
                  "text-sm font-medium " +
                  (reached ? "text-slate-900" : "text-slate-400")
                }
              >
                {step}
                {active && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Current
                  </span>
                )}
              </div>
              {timeFor(step) && (
                <div className="text-xs text-slate-500">{timeFor(step)}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
