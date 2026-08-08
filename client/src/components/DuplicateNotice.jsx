import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

// Shown before final submit when a similar recent complaint exists nearby.
// Citizen may review the existing one or proceed anyway.
export default function DuplicateNotice({ matches, onProceed, onCancel }) {
  const many = matches.length > 1;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">
            Similar complaint may already exist nearby
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            We found {matches.length} recent complaint{many ? "s" : ""} of the
            same type on this street. Please review before submitting a
            duplicate.
          </p>

          <ul className="mt-3 space-y-2">
            {matches.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-amber-200 bg-white p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{m.id}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {m.status}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">
                  {m.type} · {m.street}
                </p>
                <p className="mt-1 line-clamp-2 text-slate-500">
                  {m.description}
                </p>
                <Link
                  to={`/track/${m.id}`}
                  className="mt-1 inline-block text-xs font-medium text-slate-700 underline"
                >
                  View this complaint
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={onProceed}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Submit anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
