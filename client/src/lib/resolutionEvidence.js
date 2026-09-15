// CivicPulse — ResolutionEvidence domain (M8)
//
// Append-only array of evidence that staff submitted claiming work was
// performed (a photo or a note). M8 records SUBMISSION ONLY: there is no
// verification model yet — no verified/verifiedBy/verificationStatus fields,
// because who verifies, when, and what counts as valid evidence are still
// OPEN architectural decisions. Do not add them silently.
//
// People are referenced ONLY by personId. No staff names/phones and no
// citizen contact data ever enter this store.

import { STORAGE_KEYS } from "../config";
import { read, write } from "./repo";
import { getComplaint } from "./complaints";
import { personById } from "./roles";
import { appendEvent } from "./complaintEvents";

const EVIDENCE_KINDS = ["photo", "note"];

async function all() {
  return read(STORAGE_KEYS.resolutionEvidence, []);
}

export async function listEvidence() {
  return all();
}

export async function listEvidenceFor(complaintId) {
  const list = await all();
  return list.filter((e) => e.complaintId === complaintId);
}

// Append one evidence record. ID is a local sequence (EV-0001), max+1, exactly
// like complaint ids. Validations reject rather than partially write:
//   - complaint must exist
//   - submitter must be a seeded person
//   - kind must be "photo" | "note"; content non-empty
//     (photo content is a JPEG data URL from the existing PhotoInput pipeline)
export async function addEvidence({ complaintId, kind, content, submittedBy }) {
  const complaint = await getComplaint(complaintId);
  if (!complaint) {
    throw new Error(`CivicPulse: cannot attach evidence to unknown complaint "${complaintId}"`);
  }
  if (!EVIDENCE_KINDS.includes(kind)) {
    throw new Error(`CivicPulse: unknown evidence kind "${kind}"`);
  }
  if (!content || !String(content).trim()) {
    throw new Error("CivicPulse: evidence content is empty");
  }
  if (!personById(submittedBy)) {
    throw new Error(`CivicPulse: unknown evidence submitter "${submittedBy}"`);
  }

  const list = await all();
  const maxSeq = list.reduce((m, e) => {
    const n = parseInt(String(e.id).split("-").pop(), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  const record = {
    id: `EV-${String(maxSeq + 1).padStart(4, "0")}`,
    complaintId,
    kind,
    content,
    submittedBy,
    submittedAt: Date.now(),
  };
  list.push(record);
  await write(STORAGE_KEYS.resolutionEvidence, list);

  // M8.5 Part D: every evidence submission is an event in the M7 append-only
  // log, same shape rule as CREATED/STATUS_CHANGED/ASSIGNED. Write order is
  // evidence → event (strict-propagate; a refused event write rejects AFTER
  // the evidence row is stored — documented partial persistence, never hidden).
  await appendEvent({
    complaintId,
    type: "EVIDENCE_SUBMITTED",
    actor: submittedBy,
    at: record.submittedAt,
    evidenceId: record.id,
    kind,
  });

  return record;
}
