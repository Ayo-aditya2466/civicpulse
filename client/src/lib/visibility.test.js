// CivicPulse — tests for queue visibility (M8.5, Part B)
//
// Covers: department scoping, the assigned-to-me union rule, the
// no-staff-selected fallback, and the deliberate ABSENCE of complaint-type →
// specific worker routing (visibility must not vary by complaint type).

import { describe, it, expect } from "vitest";
import { visibleComplaints, assignedTo } from "./visibility";
import { personById } from "./roles";

const MANAGER_CON = "W6-CON-03"; // Construction manager
const WORKER_SAN = "W6-SAN-02"; // Sanitation worker
const DUAL_MANAGER = "W6-WAT-05"; // Water Supply + Construction manager

const complaints = [
  { id: "C1", dept: "Construction", type: "Pothole / Road Damage" },
  { id: "C2", dept: "Sanitation", type: "Garbage" },
  { id: "C3", dept: "Sanitation", type: "Drainage Issues" },
  { id: "C4", dept: "Electrical", type: "Streetlight Failure" },
  { id: "C5", dept: "Garden", type: "Fallen Trees" },
];

describe("department visibility", () => {
  it("a manager sees their own department's complaints", () => {
    const rows = visibleComplaints(personById(MANAGER_CON), complaints, []);
    expect(rows.map((c) => c.id)).toEqual(["C1"]);
  });

  it("a multi-department manager sees every department they oversee", () => {
    const rows = visibleComplaints(personById(DUAL_MANAGER), complaints, []);
    expect(rows.map((c) => c.id)).toEqual(["C1"]); // Water Supply has none here
  });

  it("a worker sees their department plus complaints assigned to them (union)", () => {
    // C4 is Electrical but assigned to the Sanitation worker — still visible.
    const assignments = [{ complaintId: "C4", assigneeId: WORKER_SAN }];
    const rows = visibleComplaints(
      personById(WORKER_SAN),
      complaints,
      assignments,
    );
    expect(rows.map((c) => c.id)).toEqual(["C2", "C3", "C4"]);
  });

  it("no staff selected → everything visible (placeholder identity)", () => {
    expect(visibleComplaints(null, complaints, [])).toHaveLength(5);
  });
});

describe("assignedToMe visibility", () => {
  it("returns exactly the complaints currently assigned to the person", () => {
    const assignments = [
      { complaintId: "C4", assigneeId: WORKER_SAN },
      { complaintId: "C1", assigneeId: MANAGER_CON },
    ];
    expect(assignedTo(WORKER_SAN, complaints, assignments).map((c) => c.id)).toEqual(["C4"]);
    expect(assignedTo(MANAGER_CON, complaints, assignments).map((c) => c.id)).toEqual(["C1"]);
  });

  it("reassignment moves the complaint — one current assignment only", () => {
    const assignments = [{ complaintId: "C4", assigneeId: WORKER_SAN }];
    expect(assignedTo("W6-SAN-01", complaints, assignments)).toEqual([]);
  });

  it("empty inputs behave, not crash", () => {
    expect(assignedTo(null, complaints, [])).toEqual([]);
    expect(assignedTo(WORKER_SAN, [], [])).toEqual([]);
  });
});

describe("no complaint-type → worker routing (deliberately absent)", () => {
  it("visibility is identical for every complaint type in a department", () => {
    const rows = visibleComplaints(personById(WORKER_SAN), complaints, []);
    // C2 (Garbage) and C3 (Drainage Issues) are different types in the same
    // department — both visible, neither preferentially routed to anyone.
    expect(rows.map((c) => c.id)).toContain("C2");
    expect(rows.map((c) => c.id)).toContain("C3");
    // No assignment exists, and none is inferred from the type.
    expect(assignedTo(WORKER_SAN, complaints, [])).toEqual([]);
  });
});
