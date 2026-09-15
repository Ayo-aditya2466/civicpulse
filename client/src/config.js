// CivicPulse — app configuration
// Central place for app constants so nothing is hardcoded across screens.

export const APP_NAME = "CivicPulse";

// Base URL of the Gemini proxy. Reads VITE_PROXY_BASE_URL at build time (set on
// the deploy host to the real proxy URL); defaults to the local proxy so local
// development works with no env configuration.
export const PROXY_BASE_URL =
  import.meta.env.VITE_PROXY_BASE_URL || "http://localhost:3001";

// localStorage keys used with lib/storage.js. Keep keys here, not inline.
export const STORAGE_KEYS = {
  complaints: "complaints", // operational complaint data (officer-visible)
  contacts: "contacts", // citizen personal info (never officer-visible)
  seedVersion: "seedVersion", // demo-data version currently in the store (M8.5)
  complaintEvents: "complaintEvents", // append-only ComplaintEvent log (M7)
  decisionResults: "decisionResults", // append-only DecisionResult log (M7)
  assignments: "assignments", // one current Assignment per complaintId (M8)
  resolutionEvidence: "resolutionEvidence", // append-only evidence array (M8)
  currentStaff: "currentStaff", // personId of the placeholder-signed-in staff (M8)
};

// Bump whenever the demo seed data changes: a browser running an older
// version gets its demo rows (demo: true) replaced with the current set;
// real user-submitted complaints are never touched. (The M8-era boolean
// `seeded` flag froze old demo data forever on used browsers — that key is
// now orphaned in those stores and simply ignored.)
export const SEED_VERSION = "ward6-v1";

// Complaint lifecycle. Order defines the timeline; index defines progress.
export const STATUS_FLOW = ["Submitted", "Assigned", "In Progress", "Resolved"];

// Complaint ID format: `${PREFIX}-${ward}-0001`.
export const COMPLAINT_ID_PREFIX = "CP";

// Duplicate-suggestion window: same street + type within this many hours.
export const DUPLICATE_WINDOW_HOURS = 168; // 7 days
