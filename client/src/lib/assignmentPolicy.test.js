// CivicPulse — tests for the assignment policy seam (M8.5, Part A)
//
// Covers: the interim allow/deny matrix with its policy strings, the
// DecisionResult audit trail (allowed AND denied decisions), eligible-assignee
// listing (workers get nothing), the M6 write-failure contract, and the
// citizen-contact privacy boundary on decision records.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { canAssign, eligibleAssignees } from "./assignmentPolicy";
import { listDecisionsFor } from "./decisionResults";
import { personById } from "./roles";

const MANAGER = "W6-CON-03"; // Jamir Patel — City Engineer, Construction (manager)
const DUAL_MANAGER = "W6-WAT-05"; // Vikram Darade — Water Supply + Construction
const WORKER_SAN = "W6-SAN-02"; // Kisan Gohil — Sanitation Mukadam (worker)
const WORKER_ELE = "W6-ELE-02"; // Dnyandev Waghmare — Electrical JE (worker)
const OPEN_SUPERVISOR = "W6-GAR-01"; // plain "Supervisor" — deliberately OPEN

// canAssign only reads id + dept from the complaint; a fabricated record is
// the honest unit boundary (no store writes needed for the complaint itself).
const sanitationComplaint = { id: "CP-W6-0100", dept: "Sanitation" };
const nullDeptComplaint = { id: "CP-W6-0101", dept: null };

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("canAssign — interim policy matrix", () => {
  it("allows a manager to assign a dept-matched worker, with the interim policy string", async () => {
    const d = await canAssign(
      personById(MANAGER),
      sanitationComplaint,
      personById(WORKER_SAN),
    );
    expect(d).toEqual({
      allowed: true,
      reason: expect.stringContaining("interim policy"),
      policy: "interim:manager-any-dept+assignee-dept-match",
    });
  });

  it("allows a manager affiliated with a different department (interim: any manager)", async () => {
    const d = await canAssign(
      personById(DUAL_MANAGER),
      sanitationComplaint,
      personById(WORKER_SAN),
    );
    expect(d.allowed).toBe(true);
  });

  it("denies a worker actor — workers cannot use manager-only assign actions", async () => {
    const d = await canAssign(
      personById(WORKER_SAN),
      sanitationComplaint,
      personById(WORKER_SAN),
    );
    expect(d.allowed).toBe(false);
    expect(d.policy).toBe("interim:actor-not-manager");
  });

  it("denies an absent/unknown actor", async () => {
    const d = await canAssign(null, sanitationComplaint, personById(WORKER_SAN));
    expect(d.allowed).toBe(false);
    expect(d.policy).toBe("interim:actor-not-manager");
    expect(d.reason).toMatch(/is not a manager/);
  });

  it("denies an OPEN plain-Supervisor assignee without classifying them", async () => {
    const d = await canAssign(
      personById(MANAGER),
      sanitationComplaint,
      personById(OPEN_SUPERVISOR),
    );
    expect(d.allowed).toBe(false);
    expect(d.policy).toBe("interim:assignee-not-worker");
    // Still OPEN: the denial message says pending clarification, not a role.
    expect(d.reason).toMatch(/pending clarification/);
  });

  it("denies a dept-mismatched worker", async () => {
    const d = await canAssign(
      personById(MANAGER),
      sanitationComplaint,
      personById(WORKER_ELE),
    );
    expect(d.allowed).toBe(false);
    expect(d.policy).toBe("interim:assignee-dept-mismatch");
  });

  it("denies a complaint with no department", async () => {
    const d = await canAssign(
      personById(MANAGER),
      nullDeptComplaint,
      personById(WORKER_SAN),
    );
    expect(d.allowed).toBe(false);
    expect(d.policy).toBe("interim:complaint-no-dept");
  });
});

describe("DecisionResult audit trail (kind: assignment-authority)", () => {
  it("records every ALLOWED decision with the policy string", async () => {
    await canAssign(
      personById(MANAGER),
      sanitationComplaint,
      personById(WORKER_SAN),
    );
    const decisions = await listDecisionsFor(sanitationComplaint.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      complaintId: sanitationComplaint.id,
      kind: "assignment-authority",
      source: "rule",
      result: { allowed: true, policy: "interim:manager-any-dept+assignee-dept-match" },
    });
    expect(decisions[0].detail.reason).toBeTruthy();
  });

  it("records DENIED decisions too — denials are auditable", async () => {
    await canAssign(
      personById(WORKER_SAN),
      sanitationComplaint,
      personById(WORKER_SAN),
    );
    const [d] = await listDecisionsFor(sanitationComplaint.id);
    expect(d.result).toEqual({
      allowed: false,
      policy: "interim:actor-not-manager",
    });
  });

  it("is append-only — a re-check appends, never edits", async () => {
    await canAssign(
      personById(MANAGER),
      sanitationComplaint,
      personById(WORKER_ELE),
    );
    await canAssign(
      personById(MANAGER),
      sanitationComplaint,
      personById(WORKER_SAN),
    );
    const decisions = await listDecisionsFor(sanitationComplaint.id);
    expect(decisions).toHaveLength(2);
    expect(decisions[0].result.allowed).toBe(false);
    expect(decisions[1].result.allowed).toBe(true);
  });

  it("propagates a refused store write (M6 contract)", async () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      canAssign(personById(MANAGER), sanitationComplaint, personById(WORKER_SAN)),
    ).rejects.toThrow(/storage write failed/);
  });

  it("carries no citizen contact or staff phone data", async () => {
    await canAssign(
      personById(MANAGER),
      sanitationComplaint,
      personById(WORKER_SAN),
    );
    const [d] = await listDecisionsFor(sanitationComplaint.id);
    const serialized = JSON.stringify(d);
    expect(serialized).not.toMatch(/"phone"|7972211289|Kisan Gohil|Jamir Patel/);
    expect(serialized).not.toMatch(/contact|email|address/i);
  });
});

describe("eligibleAssignees", () => {
  it("lists the complaint department's workers for a manager", () => {
    const workers = eligibleAssignees(
      personById(MANAGER),
      sanitationComplaint,
    );
    expect(workers.map((w) => w.id)).toEqual([
      "W6-SAN-01",
      "W6-SAN-02",
      "W6-SAN-03",
      "W6-SAN-04",
    ]);
  });

  it("returns nothing for a worker or an OPEN person — no assign UI data", () => {
    expect(eligibleAssignees(personById(WORKER_SAN), sanitationComplaint)).toEqual([]);
    expect(eligibleAssignees(personById(OPEN_SUPERVISOR), sanitationComplaint)).toEqual([]);
    expect(eligibleAssignees(null, sanitationComplaint)).toEqual([]);
  });

  it("returns nothing for a complaint without a department", () => {
    expect(eligibleAssignees(personById(MANAGER), nullDeptComplaint)).toEqual([]);
    expect(eligibleAssignees(personById(MANAGER), null)).toEqual([]);
  });
});
