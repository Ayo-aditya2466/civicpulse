import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, MapPin, Clock } from "lucide-react";
import { getComplaint, advanceStatus } from "../lib/complaints";
import { slaFor, formatRemaining } from "../lib/sla";
import { STATUS_FLOW } from "../config";
import StatusTimeline from "../components/StatusTimeline";
import SlaBadge from "../components/SlaBadge";

function fmt(at) {
  return new Date(at).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OfficerComplaintDetail() {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(() => getComplaint(id));

  if (!complaint) return <Navigate to="/officer" replace />;

  const isFinal =
    STATUS_FLOW.indexOf(complaint.status) >= STATUS_FLOW.length - 1;
  const nextStatus = isFinal
    ? null
    : STATUS_FLOW[STATUS_FLOW.indexOf(complaint.status) + 1];
  const { remainingMs, level } = slaFor(complaint);

  function handleAdvance() {
    const updated = advanceStatus(complaint.id);
    if (updated) setComplaint(updated);
  }

  return (
    <div className="space-y-5">
      <Link
        to="/officer"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={15} /> Back to queue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">
              {complaint.type}
            </h1>
            <span className="text-sm text-slate-400">{complaint.id}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPin size={14} /> {complaint.street} · {complaint.dept}
          </p>
        </div>
        <SlaBadge complaint={complaint} />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-5 md:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            {complaint.photo && (
              <img
                src={complaint.photo}
                alt="Reported issue"
                className="mb-4 w-full rounded-lg border border-slate-200"
              />
            )}
            <h2 className="text-sm font-semibold text-slate-800">
              Description
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {complaint.description}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Reported</dt>
                <dd className="text-slate-800">{fmt(complaint.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Last updated</dt>
                <dd className="text-slate-800">{fmt(complaint.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Ward</dt>
                <dd className="text-slate-800">{complaint.wardId}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={11} /> SLA
                </dt>
                <dd
                  className={
                    level === "overdue"
                      ? "font-medium text-red-600"
                      : "text-slate-800"
                  }
                >
                  {level === "resolved"
                    ? "Closed"
                    : formatRemaining(remainingMs)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Update status
            </h2>
            <div className="mb-3 text-sm text-slate-600">
              Current:{" "}
              <span className="font-medium text-slate-900">
                {complaint.status}
              </span>
            </div>
            {isFinal ? (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                This complaint is resolved.
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdvance}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Advance to {nextStatus} <ArrowRight size={15} />
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">
              Timeline
            </h2>
            <StatusTimeline
              status={complaint.status}
              history={complaint.history}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
