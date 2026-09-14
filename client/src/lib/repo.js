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
// write() rejects when the store refuses the value. That is the whole failure
// contract, and it lives here for two reasons: a Supabase write already rejects
// natively, so this file keeps its shape when the backing store changes; and a
// rejection is one channel instead of two, so no caller has to remember to
// check a boolean it currently discards.

import { readStore, writeStore } from "./storage";

export async function read(key, fallback) {
  return readStore(key, fallback);
}

export async function write(key, value) {
  if (!writeStore(key, value)) {
    // storage.js has already logged the underlying cause.
    throw new Error(`CivicPulse: could not save "${key}" — storage write failed`);
  }
}
