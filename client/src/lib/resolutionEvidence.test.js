// CivicPulse — tests for ResolutionEvidence (M8)
//
// Covers: photo and note records, sequential EV-#### ids, validation
// rejections, append-only behavior, the M6 write-failure contract, and the
// privacy boundary (submittedBy is a personId; no names/phones/citizen
// contact anywhere). Verification fields are deliberately absent — that
// model is OPEN.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createComplaint } from "./complaints";
import { listEventsFor } from "./complaintEvents";
import {
  addEvidence,
  listEvidence,
  listEvidenceFor,
} from "./resolutionEvidence";

const NOW = new Date("2026-03-01T12:00:00.000Z").getTime();

const WORKER = "W6-SAN-02"; // Kisan Gohil — Sanitation Mukadam (worker)
const MANAGER = "W6-CON-03"; // Jamir Patel — City Engineer (manager)

const validSubmission = {
  type: "Garbage",
  street: "Bunder Mohalla",
  description: "Overflowing community bin near the masjid.",
  photo: "data:image/jpeg;base64,TEST",
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submission", () => {
  it("stores a photo evidence record from a worker", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const complaint = await createComplaint(validSubmission);
      const record = await addEvidence({
        complaintId: complaint.id,
        kind: "photo",
        content: "data:image/jpeg;base64,DONE",
        submittedBy: WORKER,
      });
      expect(record).toEqual({
        id: "EV-0001",
        complaintId: complaint.id,
        kind: "photo",
        content: "data:image/jpeg;base64,DONE",
        submittedBy: WORKER,
        submittedAt: NOW,
      });
      expect(await listEvidenceFor(complaint.id)).toEqual([record]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stores a note evidence record from a manager", async () => {
    const complaint = await createComplaint(validSubmission);
    const record = await addEvidence({
      complaintId: complaint.id,
      kind: "note",
      content: "Site inspected; lift scheduled for tomorrow.",
      submittedBy: MANAGER,
    });
    expect(record.kind).toBe("note");
    expect(record.submittedBy).toBe(MANAGER);
  });

  it("assigns sequential ids across complaints and kinds", async () => {
    const a = await createComplaint(validSubmission);
    const b = await createComplaint(validSubmission);
    const first = await addEvidence({
      complaintId: a.id,
      kind: "note",
      content: "note one",
      submittedBy: WORKER,
    });
    const second = await addEvidence({
      complaintId: b.id,
      kind: "photo",
      content: "data:image/jpeg;base64,X",
      submittedBy: MANAGER,
    });
    const third = await addEvidence({
      complaintId: a.id,
      kind: "note",
      content: "note two",
      submittedBy: WORKER,
    });
    expect([first.id, second.id, third.id]).toEqual([
      "EV-0001",
      "EV-0002",
      "EV-0003",
    ]);
    expect(await listEvidence()).toHaveLength(3);
    expect(await listEvidenceFor(a.id)).toHaveLength(2);
    expect(await listEvidenceFor(b.id)).toHaveLength(1);
  });

  it("is append-only — prior records survive later submissions", async () => {
    const complaint = await createComplaint(validSubmission);
    const first = await addEvidence({
      complaintId: complaint.id,
      kind: "note",
      content: "before",
      submittedBy: WORKER,
    });
    await addEvidence({
      complaintId: complaint.id,
      kind: "note",
      content: "after",
      submittedBy: WORKER,
    });
    const stored = await listEvidenceFor(complaint.id);
    expect(stored).toHaveLength(2);
    expect(stored[0]).toEqual(first);
  });
});

describe("validations reject without writing", () => {
  it.each([
    [
      "unknown complaint",
      { complaintId: "CP-W6-9999", kind: "note", content: "x", submittedBy: WORKER },
      /unknown complaint/,
    ],
    [
      "unknown kind",
      { kind: "video", content: "x", submittedBy: WORKER },
      /unknown evidence kind/,
    ],
    [
      "empty content",
      { kind: "note", content: "   ", submittedBy: WORKER },
      /content is empty/,
    ],
    [
      "unknown submitter",
      { kind: "note", content: "x", submittedBy: "W6-NOPE-99" },
      /unknown evidence submitter/,
    ],
  ])("%s", async (_name, opts, pattern) => {
    if (!opts.complaintId) {
      const complaint = await createComplaint(validSubmission);
      opts.complaintId = complaint.id;
    }
    await expect(addEvidence(opts)).rejects.toThrow(pattern);
    expect(await listEvidence()).toHaveLength(0);
  });
});

describe("write failure (M6 strict-propagate)", () => {
  it("rejects rather than claiming success", async () => {
    const complaint = await createComplaint(validSubmission);
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      addEvidence({
        complaintId: complaint.id,
        kind: "note",
        content: "lost note",
        submittedBy: WORKER,
      }),
    ).rejects.toThrow(/storage write failed/);
    vi.restoreAllMocks();
    expect(await listEvidence()).toHaveLength(0);
  });
});

describe("evidence events (M8.5 Part D)", () => {
  it("writes an EVIDENCE_SUBMITTED event matching the M7 shape", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const complaint = await createComplaint(validSubmission);
      const record = await addEvidence({
        complaintId: complaint.id,
        kind: "note",
        content: "Work completed.",
        submittedBy: WORKER,
      });
      const events = await listEventsFor(complaint.id);
      expect(events).toHaveLength(2); // CREATED + EVIDENCE_SUBMITTED
      expect(events[1]).toEqual({
        complaintId: complaint.id,
        type: "EVIDENCE_SUBMITTED",
        actor: WORKER,
        at: record.submittedAt, // same clock as the evidence record
        evidenceId: record.id,
        kind: "note",
        seq: 2,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps events append-only with per-complaint seq across submissions", async () => {
    const complaint = await createComplaint(validSubmission);
    await addEvidence({
      complaintId: complaint.id,
      kind: "note",
      content: "first",
      submittedBy: WORKER,
    });
    await addEvidence({
      complaintId: complaint.id,
      kind: "photo",
      content: "data:image/jpeg;base64,X",
      submittedBy: MANAGER,
    });
    const events = await listEventsFor(complaint.id);
    expect(events.map((e) => [e.type, e.seq])).toEqual([
      ["CREATED", 1],
      ["EVIDENCE_SUBMITTED", 2],
      ["EVIDENCE_SUBMITTED", 3],
    ]);
    expect(events[2].actor).toBe(MANAGER);
    expect(events[2].kind).toBe("photo");
  });

  it("strict-propagates when the event write fails after the evidence row is stored", async () => {
    const complaint = await createComplaint(validSubmission);
    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (String(key).includes("complaintEvents")) {
        throw new Error("QuotaExceededError");
      }
      realSetItem(key, value);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      addEvidence({
        complaintId: complaint.id,
        kind: "note",
        content: "orphaned note",
        submittedBy: WORKER,
      }),
    ).rejects.toThrow(/storage write failed/);
    // Documented partial persistence: the evidence row committed before the
    // event write failed; the event never appeared.
    expect(await listEvidenceFor(complaint.id)).toHaveLength(1);
    expect(await listEventsFor(complaint.id)).toHaveLength(1); // CREATED only
  });

  it("carries no citizen contact or staff phone data in the event", async () => {
    const complaint = await createComplaint(validSubmission);
    await addEvidence({
      complaintId: complaint.id,
      kind: "note",
      content: "Note.",
      submittedBy: WORKER,
    });
    const [event] = (await listEventsFor(complaint.id)).filter(
      (e) => e.type === "EVIDENCE_SUBMITTED",
    );
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/Kisan Gohil|"phone"|7972211289/);
    expect(serialized).not.toMatch(/contact|email|address/i);
  });
});

describe("privacy and scope", () => {
  it("references the submitter by personId only — no names, phones, or citizen contact", async () => {
    const complaint = await createComplaint(validSubmission);
    const record = await addEvidence({
      complaintId: complaint.id,
      kind: "note",
      content: "Work completed.",
      submittedBy: WORKER,
    });
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("Kisan Gohil");
    expect(serialized).not.toMatch(/"phone"|7972211289/);
    expect(serialized).not.toMatch(/contact|email|address/i);
  });

  it("carries no verification fields — that model is OPEN", async () => {
    const complaint = await createComplaint(validSubmission);
    const record = await addEvidence({
      complaintId: complaint.id,
      kind: "note",
      content: "Note.",
      submittedBy: WORKER,
    });
    for (const absent of [
      "verified",
      "verifiedBy",
      "verificationStatus",
      "status",
    ]) {
      expect(record).not.toHaveProperty(absent);
    }
  });
});
