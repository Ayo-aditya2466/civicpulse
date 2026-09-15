// CivicPulse — tests for the Assignment domain (M8)
//
// Covers: one current assignment per complaint, reassignment, validation
// rejections, the Submitted→Assigned auto-advance (with ASSIGNED ordered
// before STATUS_CHANGED by seq), no backward status movement, the M6
// strict-propagate failure contract, and the privacy boundary (personId
// references only — no names/phones in the record).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createComplaint,
  advanceStatus,
  getComplaint,
} from "./complaints";
import { assignComplaint, getAssignment, listAssignments } from "./assignments";
import { listEventsFor } from "./complaintEvents";

const NOW = new Date("2026-03-01T12:00:00.000Z").getTime();

// Fixtures: Jamir Patel (Construction manager) as actor; Kisan Gohil
// (Sanitation Mukadam, roleClass worker) as assignee. A Garbage complaint
// routes to Sanitation — a department that actually has workers.
const MANAGER = "W6-CON-03";
const WORKER = "W6-SAN-02";

const validSubmission = {
  type: "Garbage",
  street: "Bazar Peth",
  description: "Garbage not lifted from the corner for three days.",
  photo: "data:image/jpeg;base64,TEST",
};

async function seedComplaint() {
  return createComplaint(validSubmission);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function refuseWrites() {
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("QuotaExceededError");
  });
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("assignment creation", () => {
  it("stores one current assignment with the expected fields", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const complaint = await seedComplaint();
      const { assignment, complaint: updated } = await assignComplaint({
        complaintId: complaint.id,
        assigneeId: WORKER,
        actorId: MANAGER,
      });
      expect(assignment).toEqual({
        complaintId: complaint.id,
        dept: "Sanitation",
        assigneeId: WORKER,
        assignedBy: MANAGER,
        assignedAt: NOW,
        active: true,
      });
      expect(await getAssignment(complaint.id)).toEqual(assignment);
      expect(await listAssignments()).toHaveLength(1);
      // Submitted complaint auto-advanced to Assigned.
      expect(updated.status).toBe("Assigned");
      expect((await getComplaint(complaint.id)).status).toBe("Assigned");
    } finally {
      vi.useRealTimers();
    }
  });

  it("replaces (not accumulates) the current assignment on reassign", async () => {
    const complaint = await seedComplaint();
    await assignComplaint({
      complaintId: complaint.id,
      assigneeId: WORKER,
      actorId: MANAGER,
    });
    const { assignment } = await assignComplaint({
      complaintId: complaint.id,
      assigneeId: "W6-SAN-01", // a different Sanitation worker
      actorId: MANAGER,
    });
    expect(assignment.assigneeId).toBe("W6-SAN-01");
    expect(await getAssignment(complaint.id)).toEqual(assignment);
    expect(await listAssignments()).toHaveLength(1);
  });

  it("keeps earlier ASSIGNED events — reassignment appends history", async () => {
    const complaint = await seedComplaint();
    await assignComplaint({
      complaintId: complaint.id,
      assigneeId: WORKER,
      actorId: MANAGER,
    });
    await assignComplaint({
      complaintId: complaint.id,
      assigneeId: "W6-SAN-01",
      actorId: MANAGER,
    });
    const assigned = (await listEventsFor(complaint.id)).filter(
      (e) => e.type === "ASSIGNED",
    );
    expect(assigned.map((e) => e.assigneeId)).toEqual([WORKER, "W6-SAN-01"]);
  });
});

describe("validations reject without writing", () => {
  it.each([
    [
      "unknown complaint",
      { complaintId: "CP-W6-9999", assigneeId: WORKER, actorId: MANAGER },
      /cannot assign unknown complaint/,
    ],
    [
      "unknown assignee",
      { complaintId: null, assigneeId: "W6-NOPE-99", actorId: MANAGER },
      /unknown assignee/,
    ],
    [
      "non-worker assignee (manager)",
      { complaintId: null, assigneeId: MANAGER, actorId: MANAGER },
      /is not assignable/,
    ],
    [
      "OPEN plain Supervisor assignee",
      { complaintId: null, assigneeId: "W6-GAR-01", actorId: MANAGER },
      /is not assignable/,
    ],
    [
      "department mismatch",
      { complaintId: null, assigneeId: "W6-ELE-02", actorId: MANAGER },
      /does not match complaint department/,
    ],
    [
      "worker as actor",
      { complaintId: null, assigneeId: WORKER, actorId: WORKER },
      /is not a manager/,
    ],
    [
      "unknown actor",
      { complaintId: null, assigneeId: WORKER, actorId: "W6-NOPE-98" },
      /is not a manager/,
    ],
  ])("%s", async (_name, opts, pattern) => {
    let complaint;
    if (opts.complaintId === null) {
      complaint = await seedComplaint();
      opts.complaintId = complaint.id;
    }
    await expect(assignComplaint(opts)).rejects.toThrow(pattern);
    expect(await listAssignments()).toHaveLength(0);
    if (complaint) {
      const events = await listEventsFor(complaint.id);
      expect(events.filter((e) => e.type === "ASSIGNED")).toHaveLength(0);
      expect((await getComplaint(complaint.id)).status).toBe("Submitted");
    }
  });

  it("rejects a complaint with no department (Encroachment routes to null)", async () => {
    const complaint = await createComplaint({
      type: "Encroachment",
      street: "Tilak Chowk",
      description: "Vendor stall blocking footpath.",
      photo: "data:image/jpeg;base64,TEST",
    });
    expect(complaint.dept).toBeNull();
    await expect(
      assignComplaint({
        complaintId: complaint.id,
        assigneeId: WORKER,
        actorId: MANAGER,
      }),
    ).rejects.toThrow(/has no department to assign within/);
  });
});

describe("lifecycle interaction", () => {
  it("auto-advances a Submitted complaint with ASSIGNED before STATUS_CHANGED", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const complaint = await seedComplaint();
      await assignComplaint({
        complaintId: complaint.id,
        assigneeId: WORKER,
        actorId: MANAGER,
      });
      const events = await listEventsFor(complaint.id);
      expect(events.map((e) => e.type)).toEqual([
        "CREATED",
        "ASSIGNED",
        "STATUS_CHANGED",
      ]);
      expect(events[1]).toMatchObject({
        actor: MANAGER,
        assigneeId: WORKER,
        dept: "Sanitation",
        at: NOW,
      });
      expect(events[2]).toMatchObject({
        actor: MANAGER,
        from: "Submitted",
        to: "Assigned",
      });
      // seq is strictly increasing across the mixed types.
      expect(events[1].seq).toBe(2);
      expect(events[2].seq).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not move an already-advanced complaint backward or duplicate the transition", async () => {
    const complaint = await seedComplaint();
    // Citizen-side… no: staff advances it past Submitted first.
    await advanceStatus(complaint.id, { actorId: MANAGER }); // → Assigned
    const { complaint: afterAssign } = await assignComplaint({
      complaintId: complaint.id,
      assigneeId: WORKER,
      actorId: MANAGER,
    });
    expect(afterAssign.status).toBe("Assigned"); // unchanged
    const events = await listEventsFor(complaint.id);
    expect(events.filter((e) => e.type === "STATUS_CHANGED")).toHaveLength(1);
    expect(events.map((e) => e.type)).toEqual([
      "CREATED",
      "STATUS_CHANGED",
      "ASSIGNED",
    ]);
  });

  it("records assignment alone for a Resolved complaint (no re-transition)", async () => {
    const complaint = await seedComplaint();
    for (let i = 0; i < 3; i++) {
      await advanceStatus(complaint.id, { actorId: MANAGER });
    }
    expect((await getComplaint(complaint.id)).status).toBe("Resolved");
    const { complaint: after } = await assignComplaint({
      complaintId: complaint.id,
      assigneeId: WORKER,
      actorId: MANAGER,
    });
    expect(after.status).toBe("Resolved");
    expect(
      (await listEventsFor(complaint.id)).filter(
        (e) => e.type === "STATUS_CHANGED",
      ),
    ).toHaveLength(3);
  });
});

describe("write failure (M6 strict-propagate)", () => {
  it("rejects when every write is refused", async () => {
    const complaint = await seedComplaint();
    refuseWrites();
    await expect(
      assignComplaint({
        complaintId: complaint.id,
        assigneeId: WORKER,
        actorId: MANAGER,
      }),
    ).rejects.toThrow(/storage write failed/);
  });

  it("rejects when the ASSIGNED event write fails after the assignment itself is stored", async () => {
    const complaint = await seedComplaint();
    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (String(key).includes("complaintEvents")) {
        throw new Error("QuotaExceededError");
      }
      realSetItem(key, value);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      assignComplaint({
        complaintId: complaint.id,
        assigneeId: WORKER,
        actorId: MANAGER,
      }),
    ).rejects.toThrow(/storage write failed/);
    // Documented partial persistence: the assignment row committed before the
    // event write failed; the status was never advanced.
    expect((await getAssignment(complaint.id))?.assigneeId).toBe(WORKER);
    expect((await getComplaint(complaint.id)).status).toBe("Submitted");
  });
});

describe("privacy boundary", () => {
  it("stores personId references only — no names or phone numbers", async () => {
    const complaint = await seedComplaint();
    const { assignment } = await assignComplaint({
      complaintId: complaint.id,
      assigneeId: WORKER,
      actorId: MANAGER,
    });
    const serialized = JSON.stringify(assignment);
    expect(serialized).not.toContain("Kisan Gohil");
    expect(serialized).not.toContain("Jamir Patel");
    expect(serialized).not.toMatch(/"phone"|7972211289|7498203878/);
    expect(serialized).not.toMatch(/contact|name|email/i);
  });
});
