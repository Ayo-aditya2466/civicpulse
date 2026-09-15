// CivicPulse — ComplaintEvent append-only log (M7)
//
// One structured record per thing that happened to a complaint. APPEND-ONLY is
// a hard requirement: existing events are never edited or deleted to represent
// a new action — a new action appends a new event.
//
// Shape:
//   { complaintId, type: "CREATED" | "STATUS_CHANGED" | "ASSIGNED" |
//                        "EVIDENCE_SUBMITTED", actor, at, seq, ...typeFields }
//   ASSIGNED adds: assigneeId, dept (see lib/assignments.js).
//   EVIDENCE_SUBMITTED adds: evidenceId, kind (see lib/resolutionEvidence.js).
//
// `seq` is PER-COMPLAINT: (max seq among that complaint's events) + 1. Two
// events with the same `at` timestamp still order correctly by seq.
// Callers do not pass seq — appendEvent() assigns it, so it can never drift.
//
// `actor` is a string. Citizens are actor: "citizen". Staff actions carry the
// acting person's id from seed.js (M8); historical M7 records with
// actor: "officer" remain valid and are never rewritten.
//
// Backed by the same storage.js/repo.js seam as everything else; a refused
// write rejects (M6 Step 1C contract), so a failed append is never silent.

import { STORAGE_KEYS } from "../config";
import { read, write } from "./repo";

export async function listEvents() {
  return read(STORAGE_KEYS.complaintEvents, []);
}

export async function listEventsFor(complaintId) {
  const all = await listEvents();
  return all.filter((e) => e.complaintId === complaintId);
}

// Append one event. `event` carries everything except seq, which is assigned
// here. Returns the stored event (with seq) so callers can log or assert it.
export async function appendEvent(event) {
  const list = await listEvents();
  const maxSeq = list
    .filter((e) => e.complaintId === event.complaintId)
    .reduce((m, e) => Math.max(m, e.seq), 0);
  const stored = { ...event, seq: maxSeq + 1 };
  list.push(stored);
  await write(STORAGE_KEYS.complaintEvents, list);
  return stored;
}
