import { useParams, Link, Navigate } from "react-router-dom";
import { CheckCircle2, MapPin } from "lucide-react";
import { getComplaint } from "../lib/complaints";
import { getContact } from "../lib/contacts";
import StatusTimeline from "../components/StatusTimeline";

export default function ConfirmationPage() {
  const { id } = useParams();
  const complaint = getComplaint(id);

  if (!complaint) return <Navigate to="/" replace />;

  // Citizen-scope read; only used to greet them by name on their own receipt.
  const contact = getContact(id);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
        <h1 className="mt-3 text-xl font-semibold text-emerald-900">
          Complaint submitted successfully
        </h1>
        <p className="mt-1 text-sm text-emerald-800">
          {contact?.name
            ? `Thank you, ${contact.name}. `
            : "Thank you. "}
          Keep this ID to track your complaint.
        </p>

        <div className="mx-auto mt-4 w-fit rounded-lg border border-emerald-300 bg-white px-6 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Complaint ID
          </div>
          <div className="text-2xl font-bold tracking-wide text-slate-900">
            {complaint.id}
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-2 text-xs text-emerald-800">
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {complaint.street}
          </span>
          <span>·</span>
          <span>{complaint.type}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          Current status
        </h2>
        <StatusTimeline status={complaint.status} history={complaint.history} />
      </div>

      <Link
        to={`/track/${complaint.id}`}
        className="block w-full rounded-lg bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
      >
        Track this complaint
      </Link>
      <p className="text-center text-xs text-slate-500">
        Demo environment — status updates are simulated locally.
      </p>
    </div>
  );
}
