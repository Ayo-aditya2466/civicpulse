// CivicPulse — citizen contact store
// Personal details live in a SEPARATE store from operational complaint data.
// Only citizen-facing code may import this module; officer/field views must
// never read it. The separation is structural: operational complaints simply
// have no personal fields, and this map is keyed by complaint ID on the side.
//
// Async-shaped as of M6 Step 1B (see repo.js); the store is still localStorage.

import { STORAGE_KEYS } from "../config";
import { read, write } from "./repo";

async function all() {
  return read(STORAGE_KEYS.contacts, {});
}

// Store contact info for a complaint. Anonymous submissions (no field filled)
// create NO record at all. Returns true only when something was stored.
export async function saveContact(complaintId, { name, phone, email } = {}) {
  const hasAny = [name, phone, email].some((v) => v && String(v).trim());
  if (!hasAny) return false;
  const map = await all();
  map[complaintId] = {
    name: name?.trim() || null,
    phone: phone?.trim() || null,
    email: email?.trim() || null,
  };
  await write(STORAGE_KEYS.contacts, map);
  return true;
}

// Citizen-scope read only.
export async function getContact(complaintId) {
  return (await all())[complaintId] ?? null;
}
