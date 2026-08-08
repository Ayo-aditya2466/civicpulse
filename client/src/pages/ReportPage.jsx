import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Loader2 } from "lucide-react";
import { complaintTypes, streets } from "../data/seed";
import { createComplaint, findDuplicates } from "../lib/complaints";
import { saveContact } from "../lib/contacts";
import { classifyComplaint } from "../lib/classify";
import PhotoInput from "../components/PhotoInput";
import DuplicateNotice from "../components/DuplicateNotice";

const EMPTY = {
  type: "",
  street: "",
  description: "",
  photo: null,
  name: "",
  phone: "",
  email: "",
};

export default function ReportPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [duplicates, setDuplicates] = useState(null); // pending confirmation
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  function validate() {
    const next = {};
    if (!form.type) next.type = "Please select a complaint type.";
    if (!form.street) next.street = "Please select a street.";
    if (!form.description.trim())
      next.description = "Please describe the issue.";
    if (!form.photo) next.photo = "Please add a photo.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function finalize() {
    setSubmitting(true);
    // The one AI moment: assess severity (real Gemini, deterministic fallback).
    const assessment = await classifyComplaint({
      type: form.type,
      description: form.description.trim(),
    });
    const complaint = createComplaint({
      type: form.type,
      street: form.street,
      description: form.description.trim(),
      photo: form.photo,
      severity: assessment.severity,
      aiNote: assessment.aiNote,
      source: assessment.source,
    });
    // Personal info (if any) is stored separately, keyed by complaint ID.
    saveContact(complaint.id, {
      name: form.name,
      phone: form.phone,
      email: form.email,
    });
    navigate(`/confirmation/${complaint.id}`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    const matches = findDuplicates({ type: form.type, street: form.street });
    if (matches.length > 0) {
      setDuplicates(matches);
      return;
    }
    finalize();
  }

  if (duplicates) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">
          Before you submit
        </h1>
        <DuplicateNotice
          matches={duplicates}
          onProceed={finalize}
          onCancel={() => setDuplicates(null)}
          proceeding={submitting}
        />
      </div>
    );
  }

  const inputClass = (key) =>
    "w-full rounded-md border px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 " +
    (errors[key] ? "border-red-400 bg-red-50" : "border-slate-300");

  const renderErr = (key) =>
    errors[key] ? (
      <p className="mt-1 text-xs text-red-600">{errors[key]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Report a civic issue
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ward W14 · Kaman-Anjur Cluster. Your report reaches the right
          department automatically.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Complaint type <span className="text-red-500">*</span>
          </label>
          <select
            value={form.type}
            onChange={set("type")}
            className={inputClass("type")}
          >
            <option value="">Select a type…</option>
            {complaintTypes.map((c) => (
              <option key={c.type} value={c.type}>
                {c.type} — {c.dept}
              </option>
            ))}
          </select>
          {renderErr("type")}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Street / location <span className="text-red-500">*</span>
          </label>
          <select
            value={form.street}
            onChange={set("street")}
            className={inputClass("street")}
          >
            <option value="">Select a street…</option>
            {streets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {renderErr("street")}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={set("description")}
            rows={4}
            placeholder="Describe the issue, landmark, and how long it has been a problem."
            className={inputClass("description")}
          />
          {renderErr("description")}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Photo <span className="text-red-500">*</span>
          </label>
          <PhotoInput
            value={form.photo}
            onChange={set("photo")}
            error={!!errors.photo}
          />
          {renderErr("photo")}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Contact details (optional)
          </h2>
          <p className="text-xs text-slate-500">
            You may report anonymously. If provided, your details stay private
            and are never shown to field staff.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Name
            </label>
            <input
              value={form.name}
              onChange={set("name")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Phone
            </label>
            <input
              value={form.phone}
              onChange={set("phone")}
              inputMode="tel"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Email
            </label>
            <input
              value={form.email}
              onChange={set("email")}
              inputMode="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Send size={16} />
            Submit complaint
          </>
        )}
      </button>
    </form>
  );
}
