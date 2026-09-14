// CivicPulse — tests for the DecisionResult append-only log (M7)
//
// Covers: department-routing and severity recording, exact source preservation
// (rule / ai / fallback are never flattened), confidence and reasoning
// preservation, the no-decision/no-record rule, strict-propagate failure, and
// append-only behaviour.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createComplaint, listComplaints } from "./complaints";
import {
  listDecisionsFor,
  recordDecision,
} from "./decisionResults";

const NOW = new Date("2026-03-01T12:00:00.000Z").getTime();

const validSubmission = {
  type: "Streetlight Failure",
  street: "Dargah Road",
  description: "Streetlight dark for a week near the corner.",
  photo: "data:image/jpeg;base64,TEST",
};

beforeEach(() => {
  localStorage.clear();
});

function refuseWrites() {
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("QuotaExceededError");
  });
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// department-routing
// ---------------------------------------------------------------------------
describe("department-routing decision", () => {
  it("is recorded with the routed department and source 'rule'", async () => {
    const complaint = await createComplaint(validSubmission);
    const decisions = await listDecisionsFor(complaint.id);
    const routing = decisions.find((d) => d.kind === "department-routing");
    expect(routing).toMatchObject({
      complaintId: complaint.id,
      kind: "department-routing",
      result: "Electrical",
      source: "rule",
    });
    expect(typeof routing.createdAt).toBe("number");
  });

  it("records a null department as null — not skipped, not guessed", async () => {
    const complaint = await createComplaint({
      ...validSubmission,
      type: "Encroachment",
    });
    const routing = (await listDecisionsFor(complaint.id)).find(
      (d) => d.kind === "department-routing",
    );
    expect(routing.result).toBeNull();
    expect(routing.source).toBe("rule");
  });
});

// ---------------------------------------------------------------------------
// severity
// ---------------------------------------------------------------------------
describe("severity decision", () => {
  it("is recorded with the actual source preserved ('ai' stays 'ai')", async () => {
    const complaint = await createComplaint({
      ...validSubmission,
      severity: 3,
      aiNote: "Live wire near a school entrance.",
      source: "ai",
      confidence: 0.87,
    });
    const severity = (await listDecisionsFor(complaint.id)).find(
      (d) => d.kind === "severity",
    );
    expect(severity).toMatchObject({
      complaintId: complaint.id,
      kind: "severity",
      result: 3,
      source: "ai",
    });
    expect(severity.detail).toEqual({
      confidence: 0.87,
      aiNote: "Live wire near a school entrance.",
    });
  });

  it("preserves 'fallback' as 'fallback' — never relabelled as 'rule'", async () => {
    const complaint = await createComplaint({
      ...validSubmission,
      severity: 2,
      aiNote: "Baseline severity; no escalating factors detected.",
      source: "fallback",
      confidence: 0.5,
    });
    const severity = (await listDecisionsFor(complaint.id)).find(
      (d) => d.kind === "severity",
    );
    expect(severity.source).toBe("fallback");
    expect(severity.detail.confidence).toBe(0.5);
    expect(severity.detail.aiNote).toBe(
      "Baseline severity; no escalating factors detected.",
    );
  });

  it("records no severity decision when no severity was supplied", async () => {
    const complaint = await createComplaint(validSubmission);
    const kinds = (await listDecisionsFor(complaint.id)).map((d) => d.kind);
    expect(kinds).toEqual(["department-routing"]);
  });

  it("omits absent detail fields rather than storing nulls", async () => {
    const complaint = await createComplaint({
      ...validSubmission,
      severity: 4,
      source: "ai",
      // no aiNote, no confidence
    });
    const severity = (await listDecisionsFor(complaint.id)).find(
      (d) => d.kind === "severity",
    );
    expect(severity.result).toBe(4);
    expect(severity.detail).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Append-only
// ---------------------------------------------------------------------------
describe("append-only log", () => {
  it("appends a re-decision rather than replacing the earlier record", async () => {
    // Create WITH a severity, so an earlier severity record exists to append
    // alongside — that is what "append, not replace" actually means here.
    const complaint = await createComplaint({
      ...validSubmission,
      severity: 3,
      aiNote: "Baseline severity.",
      source: "fallback",
      confidence: 0.5,
    });
    expect(await listDecisionsFor(complaint.id)).toHaveLength(2); // routing + severity

    await recordDecision({
      complaintId: complaint.id,
      kind: "severity",
      result: 5,
      source: "rule",
    });

    const forComplaint = await listDecisionsFor(complaint.id);
    expect(forComplaint).toHaveLength(3);
    const severities = forComplaint.filter((d) => d.kind === "severity");
    expect(severities).toHaveLength(2);
    // The earlier record survives the re-decision untouched.
    expect(severities[0]).toMatchObject({ result: 3, source: "fallback" });
    expect(severities[1]).toMatchObject({ result: 5, source: "rule" });
  });

  it("keeps decisions for different complaints side by side", async () => {
    const a = await createComplaint(validSubmission);
    const b = await createComplaint(validSubmission);
    expect(await listDecisionsFor(a.id)).toHaveLength(1);
    expect(await listDecisionsFor(b.id)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Failure contract (strict-propagate)
// ---------------------------------------------------------------------------
describe("write failure", () => {
  it("rejects recordDecision rather than claiming success", async () => {
    refuseWrites();
    await expect(
      recordDecision({ complaintId: "CP-W6-0001", kind: "severity", result: 3, source: "rule" }),
    ).rejects.toThrow(/storage write failed/);
  });

  it("rejects createComplaint when a DECISION write fails after the complaint is saved", async () => {
    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (String(key).includes("decisionResults")) {
        throw new Error("QuotaExceededError");
      }
      realSetItem(key, value);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createComplaint(validSubmission)).rejects.toThrow(
      /storage write failed/,
    );
    // Complaint + CREATED event landed; the decision did not — and the
    // operation still rejected. Documented strict-propagate consequence.
    expect(await listComplaints()).toHaveLength(1);
  });

  it("defaults createdAt to the current clock when not supplied", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const stored = await recordDecision({
        complaintId: "CP-W6-0001",
        kind: "severity",
        result: 3,
        source: "rule",
      });
      expect(stored.createdAt).toBe(NOW);
    } finally {
      vi.useRealTimers();
    }
  });
});
