// CivicPulse — generic localStorage helper
// Thin, namespaced JSON wrapper. No complaint/domain logic lives here;
// M1/M2 build their state on top of these primitives.

const PREFIX = "civicpulse:";

const withPrefix = (key) => `${PREFIX}${key}`;

// Read a JSON value. Returns `fallback` if missing or unparseable.
export function readStore(key, fallback = null) {
  try {
    const raw = localStorage.getItem(withPrefix(key));
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Write a JSON-serializable value. Returns true on success.
export function writeStore(key, value) {
  try {
    localStorage.setItem(withPrefix(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Remove a single key.
export function removeStore(key) {
  try {
    localStorage.removeItem(withPrefix(key));
    return true;
  } catch {
    return false;
  }
}
