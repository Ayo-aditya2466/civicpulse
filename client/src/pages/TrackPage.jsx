import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Search } from "lucide-react";
import { getComplaint } from "../lib/complaints";
import StatusTimeline from "../components/StatusTimeline";

export default function TrackPage() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);

  // If we were handed an ID, show it; otherwise a lookup prompt + form.
  const complaint = paramId ? getComplaint(paramId) : null;

  function handleLookup(e) {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (!q) return;
    if (getComplaint(q)) {
      navigate(`/track/${q}`);
    } else {
      setNotFound(true);
    }
  }

  if (!complaint) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Track a complaint
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the complaint ID you received after submitting (e.g.{" "}
            <code className="rounded bg-slate-100 px-1">CP-W14-0001</code>).
          </p>
        </div>

        <form
          onSubmit={handleLookup}
          className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2"
        >
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotFound(false);
            }}
            placeholder="e.g. CP-W14-0001"
            className="flex-1 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          <button
            type="submit"
            className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Search size={14} />
            Track
          </button>
        </form>

        {(notFound || (paramId && !complaint)) && (
          <p className="text-sm text-red-600">
            No complaint found with that ID.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Complaint {complaint.id}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {complaint.type} · {complaint.street}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            {complaint.status}
          </span>
          <span className="text-xs text-slate-400">
            {complaint.demo ? "Demo record" : "Submitted to " + complaint.dept}
          </span>
        </div>

        {complaint.photo && (
          <img
            src={complaint.photo}
            alt="Reported issue"
            className="mb-4 w-full rounded-lg border border-slate-200"
          />
        )}

        <p className="text-sm text-slate-700">{complaint.description}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          Status timeline
        </h2>
        <StatusTimeline status={complaint.status} history={complaint.history} />
      </div>

      <Link
        to="/report"
        className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Report another issue
      </Link>
    </div>
  );
}
