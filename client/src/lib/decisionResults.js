// CivicPulse — DecisionResult append-only log (M7)
//
// A source-neutral record of a decision the system made. Deliberately NOT
// called AIResult: the system must work without AI. `source` preserves the
// real origin verbatim — "rule" (deterministic rule, e.g. department
// routing), "ai" (classify.js's AI path), "fallback" (classify.js's
// deterministic fallback). Never flattened into one value.
//
// Shape:
//   { complaintId, kind: "department-routing" | "severity", result, source,
//     detail?, createdAt }
//
// `detail` is optional and only carries what the decision-maker actually
// produced (e.g. confidence/aiNote for severity when present).
//
// APPEND-ONLY: a re-decision appends; it never edits the earlier record.
// Backed by the same storage.js/repo.js seam; a refused write rejects.

import { STORAGE_KEYS } from "../config";
import { read, write } from "./repo";

export async function listDecisions() {
  return read(STORAGE_KEYS.decisionResults, []);
}

export async function listDecisionsFor(complaintId) {
  const all = await listDecisions();
  return all.filter((d) => d.complaintId === complaintId);
}

// Append one decision. `createdAt` defaults to the current clock; complaints.js
// passes the complaint's own timestamp so the record lines up with its event.
export async function recordDecision(decision) {
  const list = await listDecisions();
  const stored = { ...decision, createdAt: decision.createdAt ?? Date.now() };
  list.push(stored);
  await write(STORAGE_KEYS.decisionResults, list);
  return stored;
}
