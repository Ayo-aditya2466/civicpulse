// CivicPulse — citizen contact store
// Personal details live in a SEPARATE store from operational complaint data.
// Only citizen-facing code may import this module; officer/field views must
// never read it. The separation is structural: operational complaints simply
// have no personal fields, and this map is keyed by complaint ID on the side.

import { STORAGE_KEYS } from "../config";
import { readStore, writeStore } from "./storage";

function all() {
  return readStore(STORAGE_KEYS.contacts, {});
}

// Store contact info for a complaint. Anonymous submissions (no field filled)
// create NO record at all. Returns true only when something was stored.
export function saveContact(complaintId, { name, phone, email } = {}) {
  const hasAny = [name, phone, email].some((v) => v && String(v).trim());
  if (!hasAny) return false;
  const map = all();
  map[complaintId] = {
    name: name?.trim() || null,
    phone: phone?.trim() || null,
    email: email?.trim() || null,
  };
  writeStore(STORAGE_KEYS.contacts, map);
  return true;
}

// Citizen-scope read only.
export function getContact(complaintId) {
  return all()[complaintId] ?? null;
}
