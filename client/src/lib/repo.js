// CivicPulse — async data-access seam
//
// The single boundary between the domain modules (complaints.js, contacts.js)
// and the storage primitive. Today it is localStorage behind a Promise; when
// Supabase replaces the backing store, only this file changes, because every
// caller above it is already async-shaped.
//
//   React pages/components
//        -> domain modules (complaints.js, contacts.js)
//        -> this seam                  <- the async boundary
//        -> storage.js                 (synchronous primitive)
//        -> localStorage
//
// Deliberately two functions and nothing else: no classes, no injection, no
// factories, no generic CRUD, no per-entity repositories, no Supabase
// abstraction. Its only job is to make storage access async-shaped.
//
// write() returns whatever storage.js returns (a boolean). Callers that ignore
// it today keep ignoring it — that behaviour is unchanged in this step.

import { readStore, writeStore } from "./storage";

export async function read(key, fallback) {
  return readStore(key, fallback);
}

export async function write(key, value) {
  return writeStore(key, value);
}
