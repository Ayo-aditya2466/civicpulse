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
  seeded: "seeded", // flag: demo complaints already injected
};

// Complaint lifecycle. Order defines the timeline; index defines progress.
export const STATUS_FLOW = ["Submitted", "Assigned", "In Progress", "Resolved"];

// Complaint ID format: `${PREFIX}-${ward}-0001`.
export const COMPLAINT_ID_PREFIX = "CP";

// Duplicate-suggestion window: same street + type within this many hours.
export const DUPLICATE_WINDOW_HOURS = 168; // 7 days
