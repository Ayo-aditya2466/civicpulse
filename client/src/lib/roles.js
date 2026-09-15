// CivicPulse — application role model (M8)
//
// Four application roles: citizen, worker, manager, admin.
//   - citizen: anonymous reporting/tracking. No person record; actor: "citizen".
//   - worker:  field personnel (Mukadams, Supervisor (SI), Junior Engineer).
//   - manager: office staff (engineers, inspectors, clerks, commissioners).
//   - admin:   vocabulary/permission model only — no seeded person, no UI.
//
// roleClass on a seed officer is an APPLICATION classification, not a claim
// about municipal rank or reporting hierarchy. Plain "Supervisor" titles carry
// roleClass: null (OPEN) pending municipal clarification.
//
// ⚠️ The permission helpers below are DETERMINISTIC APPLICATION-LEVEL checks,
// NOT security boundaries. There is no real authentication yet — the staff
// picker is a placeholder. Real enforcement arrives with auth/RLS later.
//
// Also owns the placeholder staff session (currentStaff): a single personId in
// the store saying who "signed in". It proves nothing about identity.

import { officers } from "../data/seed";
import { STORAGE_KEYS } from "../config";
import { read, write } from "./repo";

export const ROLES = {
  CITIZEN: "citizen",
  WORKER: "worker",
  MANAGER: "manager",
  ADMIN: "admin",
};

// --- Person lookup -----------------------------------------------------------
// M8.5 Part E retired ids: the M8 seed gave Vikram Darade and Vitthal Dake
// one personId per department. They are now single rows with a `depts` array;
// these aliases keep any stored assignment/event/evidence record readable.
const PERSON_ALIASES = {
  "W6-CON-04": "W6-WAT-05", // Vikram Darade (Construction → merged person)
  "W6-ELE-04": "W6-GAR-05", // Vitthal Dake (Electrical → merged person)
};

export function personById(personId) {
  const id = PERSON_ALIASES[personId] ?? personId;
  return officers.find((p) => p.id === id) ?? null;
}

export function roleClassOf(person) {
  return person?.roleClass ?? null;
}

// Workers available for assignment in a department (roleClass worker only).
// A person belongs to a department via their `depts` array (Part E), so a
// multi-department person matches every department they oversee.
export function workersInDept(dept) {
  return officers.filter(
    (p) => p.depts.includes(dept) && p.roleClass === ROLES.WORKER,
  );
}

// --- Application-level permissions (NOT security boundaries) -----------------
export const canViewQueue = (roleClass) => roleClass === ROLES.MANAGER;
export const canViewAssignedComplaints = (roleClass) =>
  roleClass === ROLES.WORKER;
export const canAssignWorkers = (roleClass) => roleClass === ROLES.MANAGER;
export const canSubmitEvidence = (roleClass) =>
  roleClass === ROLES.WORKER || roleClass === ROLES.MANAGER;
export const canAdvanceStatus = (roleClass) =>
  roleClass === ROLES.WORKER || roleClass === ROLES.MANAGER;

// --- Placeholder staff session ------------------------------------------------
// Stores the selected personId. THIS IS NOT REAL AUTHENTICATION — anyone can
// pick anyone; it only makes the console honest about who it is pretending to
// be. Replaced by real auth in a later milestone.
export async function getCurrentStaffId() {
  return read(STORAGE_KEYS.currentStaff, null);
}

export async function setCurrentStaff(personId) {
  if (!personById(personId)) {
    throw new Error(`CivicPulse: unknown staff person "${personId}"`);
  }
  await write(STORAGE_KEYS.currentStaff, personId);
}

export async function clearCurrentStaff() {
  await write(STORAGE_KEYS.currentStaff, null);
}

export async function getCurrentStaffPerson() {
  const id = await getCurrentStaffId();
  return id ? personById(id) : null;
}
