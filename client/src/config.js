// CivicPulse — app configuration
// Central place for app constants so nothing is hardcoded across screens.

export const APP_NAME = "CivicPulse";

// Base URL of the local Gemini proxy (proxy/server.js listens on 3001).
export const PROXY_BASE_URL = "http://localhost:3001";

// localStorage keys used with lib/storage.js. Keep keys here, not inline.
export const STORAGE_KEYS = {
  complaints: "complaints",
};
