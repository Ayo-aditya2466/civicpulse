// CivicPulse — Assignment domain (M8)
//
// Exactly ONE current Assignment per complaint, stored as a map keyed by
// complaintId. There is deliberately no assignment-history store: the M7
// ComplaintEvent log IS the history. Every assignment/reassignment appends an
// ASSIGNED event (actor = the manager's personId); old events are never
// edited or deleted.
//
// Assigning a complaint in the Submitted state auto-advances it to Assigned
// through the existing advanceStatus() path — no second status mechanism, and
// the STATUS_CHANGED event + complaint.history behavior stay exactly as M7
// built them. Complaints already past Submitted keep their status (never move
// backward, never re-run the transition); assignment alone is recorded.
//
// Strict-propagate write order: assignment → ASSIGNED event → status advance.
// localStorage has no transactions: a failure after the assignment write
// leaves the assignment stored while the operation rejects. That partial-
// persistence behavior is documented here rather than hidden.
//
// People are referenced ONLY by personId — no names or phone numbers are
// copied into the record, and citizen contact data never enters this store.

import { STORAGE_KEYS } from "../config";
import { read, write } from "./repo";
import { getComplaint, advanceStatus } from "./complaints";
import { appendEvent } from "./complaintEvents";
import { personById } from "./roles";
import { canAssign } from "./assignmentPolicy";

async function all() {
  return read(STORAGE_KEYS.assignments, {});
}

export async function getAssignment(complaintId) {
  return (await all())[complaintId] ?? null;
}

export async function listAssignments() {
  return Object.values(await all());
}

// Create or reassign the current Assignment for a complaint.
// Existence checks (complaint, assignee) live here; every AUTHORITY question
// is delegated to lib/assignmentPolicy.js — the single replaceable seam for
// the real municipal rule when it arrives. A policy denial rejects with the
// policy's reason, before any write happens.
export async function assignComplaint({ complaintId, assigneeId, actorId }) {
  const complaint = await getComplaint(complaintId);
  if (!complaint) {
    throw new Error(`CivicPulse: cannot assign unknown complaint "${complaintId}"`);
  }

  const assignee = personById(assigneeId);
  if (!assignee) {
    throw new Error(`CivicPulse: unknown assignee "${assigneeId}"`);
  }

  const actor = personById(actorId);
  const decision = await canAssign(actor, complaint, assignee);
  if (!decision.allowed) {
    throw new Error(`CivicPulse: ${decision.reason}`);
  }

  const now = Date.now();
  const record = {
    complaintId,
    dept: complaint.dept,
    assigneeId,
    assignedBy: actorId,
    assignedAt: now,
    active: true,
  };

  const map = await all();
  map[complaintId] = record; // one current assignment; reassignment replaces
  await write(STORAGE_KEYS.assignments, map);

  await appendEvent({
    complaintId,
    type: "ASSIGNED",
    actor: actorId, // the manager who performed the assignment — never "system"
    at: now,
    assigneeId,
    dept: record.dept,
  });

  // Only a Submitted complaint advances. Later states keep their status.
  let updated = complaint;
  if (complaint.status === "Submitted") {
    updated = await advanceStatus(complaintId, { actorId });
  }

  return { assignment: record, complaint: updated };
}
