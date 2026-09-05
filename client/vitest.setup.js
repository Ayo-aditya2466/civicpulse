// CivicPulse — test-only localStorage
//
// Node has no localStorage, and the tests must never read or write a real
// browser store. This is the smallest stand-in that satisfies lib/storage.js:
// getItem / setItem / removeItem, with getItem returning null when a key is
// absent (storage.js relies on that to apply its fallback). clear() exists for
// per-test isolation only; production code never calls it.
//
// Production storage behaviour is NOT modified — lib/storage.js is untouched.

class MemoryStorage {
  #map = new Map();

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(key, String(value));
  }

  removeItem(key) {
    this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
  }

  get length() {
    return this.#map.size;
  }
}

globalThis.localStorage = new MemoryStorage();
