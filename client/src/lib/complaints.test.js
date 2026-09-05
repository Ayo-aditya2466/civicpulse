// CivicPulse — CHARACTERIZATION tests for lib/complaints.js
//
// These tests record what the code does TODAY, before the M6 data-access
// refactor. They are a regression net, not a specification: where current
// behaviour is known to be imperfect it is pinned as-is and marked
// `KNOWN DEFECT — pinned deliberately`. If you fix one of those defects, the
// matching assertion is EXPECTED to fail — update it in the same commit as the
// fix. Do not "repair" such a test on its own.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  nextComplaintId,
  listComplaints,
  getComplaint,
  createComplaint,
  advanceStatus,
  findDuplicates,
  ensureSeeded,
} from "./complaints";
import { writeStore } from "./storage";
import {
  STORAGE_KEYS,
  STATUS_FLOW,
  DUPLICATE_WINDOW_HOURS,
} from "../config";
import { wards, complaintTypes } from "../data/seed";

const HOUR_MS = 60 * 60 * 1000;
const WARD_ID = wards[0].id;

// A fixed instant so window/boundary arithmetic is exact rather than racing the
// real clock. Chosen arbitrarily; no behaviour depends on the date itself.
const NOW = new Date("2026-03-01T12:00:00.000Z").getTime();

// Minimal stored-complaint shape, written straight through the storage helper so
// createdAt can be controlled. Mirrors what createComplaint persists.
function storedComplaint(overrides = {}) {
  return {
    id: `${"CP"}-${WARD_ID}-0001`,
    type: "Pothole",
    dept: "Road Department",
    wardId: WARD_ID,
    street: "Kaman Bhiwandi Road",
    description: "Test description.",
    photo: null,
    status: STATUS_FLOW[0],
    demo: false,
    createdAt: NOW,
    updatedAt: NOW,
    history: [{ status: STATUS_FLOW[0], at: NOW }],
    severity: null,
    aiNote: null,
    source: null,
    ...overrides,
  };
}

function seedStore(list) {
  writeStore(STORAGE_KEYS.complaints, list);
}

const validSubmission = {
  type: "Pothole",
  street: "Kaman Bhiwandi Road",
  description: "Large pothole near the junction.",
  photo: "data:image/jpeg;base64,TEST",
};

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// 1. Complaint ID generation
// ---------------------------------------------------------------------------
// nextComplaintId(list) requires its list as of M6 Step 1B — the store read now
// happens above it, in the async seam. Every expected value below is unchanged
// from Step 1A; only the call shape moved.
describe("nextComplaintId", () => {
  it("uses the CP-<ward>-<4 digit sequence> format and starts at 0001", async () => {
    expect(nextComplaintId(await listComplaints())).toBe(`CP-${WARD_ID}-0001`);
    expect(nextComplaintId(await listComplaints())).toMatch(/^CP-W14-\d{4}$/);
  });

  it("derives the ward segment from the first seed ward, not a literal", async () => {
    expect(nextComplaintId(await listComplaints()).split("-")[1]).toBe(wards[0].id);
  });

  it("numbers from the currently stored complaints", async () => {
    seedStore([storedComplaint({ id: `CP-${WARD_ID}-0003` })]);
    expect(nextComplaintId(await listComplaints())).toBe(`CP-${WARD_ID}-0004`);
  });

  it("uses only the list it is given and never touches the store", async () => {
    seedStore([storedComplaint({ id: `CP-${WARD_ID}-0009` })]);
    const explicit = [storedComplaint({ id: `CP-${WARD_ID}-0002` })];
    expect(nextComplaintId(explicit)).toBe(`CP-${WARD_ID}-0003`);
  });

  it("is max(sequence)+1, not count+1", async () => {
    seedStore([
      storedComplaint({ id: `CP-${WARD_ID}-0007` }),
      storedComplaint({ id: `CP-${WARD_ID}-0002` }),
    ]);
    expect(nextComplaintId(await listComplaints())).toBe(`CP-${WARD_ID}-0008`);
  });

  it("treats an unparseable trailing segment as sequence 0", async () => {
    seedStore([storedComplaint({ id: `CP-${WARD_ID}-ABCD` })]);
    expect(nextComplaintId(await listComplaints())).toBe(`CP-${WARD_ID}-0001`);
  });

  it("does not truncate once the sequence exceeds four digits", async () => {
    seedStore([storedComplaint({ id: `CP-${WARD_ID}-9999` })]);
    expect(nextComplaintId(await listComplaints())).toBe(`CP-${WARD_ID}-10000`);
  });

  it("gives a newly created complaint the next sequence in the store", async () => {
    seedStore([storedComplaint({ id: `CP-${WARD_ID}-0005` })]);
    expect((await createComplaint(validSubmission)).id).toBe(`CP-${WARD_ID}-0006`);
  });
});

// ---------------------------------------------------------------------------
// 2. Department mapping
//
// deptForType is module-private in complaints.js, so it is characterized through
// its only production caller — the `dept` field createComplaint writes. No
// source change was made to expose it.
// ---------------------------------------------------------------------------
describe("complaint type to department mapping", () => {
  it.each([
    ["Pothole", "Road Department"],
    ["Water Leakage", "Water Supply"],
    ["Garbage Collection", "Solid Waste Management"],
    ["Drainage Blockage", "Water Supply"],
    ["Streetlight", "Road Department"],
  ])("maps %s to %s", async (type, dept) => {
    expect((await createComplaint({ ...validSubmission, type })).dept).toBe(dept);
  });

  it("covers every complaint type present in seed.js", async () => {
    for (const entry of complaintTypes) {
      localStorage.clear();
      expect((await createComplaint({ ...validSubmission, type: entry.type })).dept).toBe(
        entry.dept,
      );
    }
    expect(complaintTypes).toHaveLength(5);
  });

  it("resolves an unknown type to null rather than throwing", async () => {
    expect((await createComplaint({ ...validSubmission, type: "Not A Type" })).dept).toBeNull();
  });

  it("stores the department as a display string, not an id", async () => {
    expect((await createComplaint(validSubmission)).dept).toBe("Road Department");
  });
});

// ---------------------------------------------------------------------------
// 3. Duplicate detection
// ---------------------------------------------------------------------------
describe("findDuplicates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches the same type on the same street inside the window", async () => {
    seedStore([storedComplaint({ createdAt: NOW - 24 * HOUR_MS })]);
    const hits = await findDuplicates({
      type: "Pothole",
      street: "Kaman Bhiwandi Road",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe(`CP-${WARD_ID}-0001`);
  });

  it("does not match a different type on the same street", async () => {
    seedStore([storedComplaint({ createdAt: NOW - 24 * HOUR_MS })]);
    expect(
      await findDuplicates({ type: "Streetlight", street: "Kaman Bhiwandi Road" }),
    ).toEqual([]);
  });

  it("does not match the same type on a different street", async () => {
    seedStore([storedComplaint({ createdAt: NOW - 24 * HOUR_MS })]);
    expect(await findDuplicates({ type: "Pothole", street: "Anjur Phata" })).toEqual([]);
  });

  it("requires an exact street string — no normalisation or fuzzy matching", async () => {
    seedStore([storedComplaint({ createdAt: NOW - 24 * HOUR_MS })]);
    expect(
      await findDuplicates({ type: "Pothole", street: "kaman bhiwandi road" }),
    ).toEqual([]);
    expect(
      await findDuplicates({ type: "Pothole", street: "Kaman Bhiwandi Road " }),
    ).toEqual([]);
  });

  it(`uses a ${DUPLICATE_WINDOW_HOURS}-hour window`, async () => {
    expect(DUPLICATE_WINDOW_HOURS).toBe(168);
    seedStore([
      storedComplaint({
        createdAt: NOW - (DUPLICATE_WINDOW_HOURS - 1) * HOUR_MS,
      }),
    ]);
    expect(
      await findDuplicates({ type: "Pothole", street: "Kaman Bhiwandi Road" }),
    ).toHaveLength(1);
  });

  it("includes a complaint sitting exactly on the cutoff (boundary is inclusive)", async () => {
    seedStore([
      storedComplaint({ createdAt: NOW - DUPLICATE_WINDOW_HOURS * HOUR_MS }),
    ]);
    expect(
      await findDuplicates({ type: "Pothole", street: "Kaman Bhiwandi Road" }),
    ).toHaveLength(1);
  });

  it("excludes a complaint one millisecond older than the cutoff", async () => {
    seedStore([
      storedComplaint({
        createdAt: NOW - DUPLICATE_WINDOW_HOURS * HOUR_MS - 1,
      }),
    ]);
    expect(
      await findDuplicates({ type: "Pothole", street: "Kaman Bhiwandi Road" }),
    ).toEqual([]);
  });

  it("returns matches newest first", async () => {
    seedStore([
      storedComplaint({ id: `CP-${WARD_ID}-0001`, createdAt: NOW - 100 * HOUR_MS }),
      storedComplaint({ id: `CP-${WARD_ID}-0002`, createdAt: NOW - 2 * HOUR_MS }),
      storedComplaint({ id: `CP-${WARD_ID}-0003`, createdAt: NOW - 50 * HOUR_MS }),
    ]);
    expect(
      (await findDuplicates({ type: "Pothole", street: "Kaman Bhiwandi Road" })).map(
        (c) => c.id,
      ),
    ).toEqual([
      `CP-${WARD_ID}-0002`,
      `CP-${WARD_ID}-0003`,
      `CP-${WARD_ID}-0001`,
    ]);
  });

  it("KNOWN DEFECT — pinned deliberately: a Resolved complaint still counts as a duplicate", async () => {
    // Audit finding. `findDuplicates` filters on type + street + window only, so
    // a closed complaint is still offered to the citizen as "already reported".
    // Pinned as current behaviour; NOT fixed in this step.
    seedStore([
      storedComplaint({
        createdAt: NOW - 96 * HOUR_MS,
        status: "Resolved",
      }),
    ]);
    const hits = await findDuplicates({
      type: "Pothole",
      street: "Kaman Bhiwandi Road",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].status).toBe("Resolved");
  });

  it("KNOWN DEFECT — pinned deliberately: demo complaints are matched alongside real ones", async () => {
    // `demo: true` rows are not excluded from duplicate suggestions.
    seedStore([storedComplaint({ createdAt: NOW - HOUR_MS, demo: true })]);
    expect(
      await findDuplicates({ type: "Pothole", street: "Kaman Bhiwandi Road" }),
    ).toHaveLength(1);
  });

  it("returns an empty array when the store is empty", async () => {
    expect(
      await findDuplicates({ type: "Pothole", street: "Kaman Bhiwandi Road" }),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Status progression
//     Submitted -> Assigned -> In Progress -> Resolved
// ---------------------------------------------------------------------------
describe("advanceStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has exactly the four prototype states in order", async () => {
    expect(STATUS_FLOW).toEqual([
      "Submitted",
      "Assigned",
      "In Progress",
      "Resolved",
    ]);
  });

  it("advances exactly one state per call", async () => {
    const id = (await createComplaint(validSubmission)).id;
    expect((await getComplaint(id)).status).toBe("Submitted");
    expect((await advanceStatus(id)).status).toBe("Assigned");
    expect((await advanceStatus(id)).status).toBe("In Progress");
    expect((await advanceStatus(id)).status).toBe("Resolved");
  });

  it("appends one { status, at } history entry per transition", async () => {
    const id = (await createComplaint(validSubmission)).id;
    expect((await getComplaint(id)).history).toEqual([{ status: "Submitted", at: NOW }]);

    vi.setSystemTime(NOW + 5 * HOUR_MS);
    const assigned = await advanceStatus(id);
    expect(assigned.history).toEqual([
      { status: "Submitted", at: NOW },
      { status: "Assigned", at: NOW + 5 * HOUR_MS },
    ]);
  });

  it("moves updatedAt to the transition time and leaves createdAt alone", async () => {
    const created = await createComplaint(validSubmission);
    expect(created.createdAt).toBe(NOW);
    expect(created.updatedAt).toBe(NOW);

    vi.setSystemTime(NOW + 3 * HOUR_MS);
    const advanced = await advanceStatus(created.id);
    expect(advanced.createdAt).toBe(NOW);
    expect(advanced.updatedAt).toBe(NOW + 3 * HOUR_MS);
  });

  it("persists the transition to the store", async () => {
    const id = (await createComplaint(validSubmission)).id;
    await advanceStatus(id);
    expect((await getComplaint(id)).status).toBe("Assigned");
    expect((await listComplaints())[0].status).toBe("Assigned");
  });

  it("is a no-op once Resolved — same status, no new history, unchanged updatedAt", async () => {
    const id = (await createComplaint(validSubmission)).id;
    await advanceStatus(id);
    await advanceStatus(id);
    const resolved = await advanceStatus(id);
    expect(resolved.status).toBe("Resolved");

    vi.setSystemTime(NOW + 99 * HOUR_MS);
    const again = await advanceStatus(id);
    expect(again.status).toBe("Resolved");
    expect(again.history).toHaveLength(4);
    expect(again.updatedAt).toBe(resolved.updatedAt);
    expect((await getComplaint(id)).history).toHaveLength(4);
  });

  it("returns null for an unknown id and writes nothing", async () => {
    await createComplaint(validSubmission);
    expect(await advanceStatus("CP-W14-9999")).toBeNull();
    expect(await listComplaints()).toHaveLength(1);
  });

  it("leaves a complaint whose status is not in STATUS_FLOW untouched", async () => {
    seedStore([storedComplaint({ status: "Reopened" })]);
    const result = await advanceStatus(`CP-${WARD_ID}-0001`);
    expect(result.status).toBe("Reopened");
    expect(result.history).toHaveLength(1);
  });

  it("never moves backwards — there is no reopen or reject transition", async () => {
    const id = (await createComplaint(validSubmission)).id;
    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await advanceStatus(id)).status);
    expect(statuses).toEqual([
      "Assigned",
      "In Progress",
      "Resolved",
      "Resolved",
      "Resolved",
      "Resolved",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Stored record shape — the structural privacy boundary
// ---------------------------------------------------------------------------
describe("createComplaint record shape", () => {
  it("accepts and stores no personal fields", async () => {
    const complaint = await createComplaint({
      ...validSubmission,
      // Passed deliberately: these must be ignored, not persisted.
      name: "Test Citizen",
      phone: "9999900000",
      email: "citizen@example.invalid",
    });
    expect(complaint).not.toHaveProperty("name");
    expect(complaint).not.toHaveProperty("phone");
    expect(complaint).not.toHaveProperty("email");
    expect(Object.keys((await listComplaints())[0])).toEqual(
      expect.not.arrayContaining(["name", "phone", "email"]),
    );
  });

  it("starts at Submitted, flags itself as non-demo, and pins the ward", async () => {
    const complaint = await createComplaint(validSubmission);
    expect(complaint.status).toBe("Submitted");
    expect(complaint.demo).toBe(false);
    expect(complaint.wardId).toBe(WARD_ID);
  });

  it("defaults the AI assessment fields to null when none is supplied", async () => {
    const complaint = await createComplaint(validSubmission);
    expect(complaint.severity).toBeNull();
    expect(complaint.aiNote).toBeNull();
    expect(complaint.source).toBeNull();
  });

  it("stores a supplied assessment inline and flat, with no version and no confidence", async () => {
    // KNOWN LIMITATION — pinned deliberately: the M3 assessment is three flat
    // fields on the complaint. `confidence` returned by the classifier is
    // discarded by the caller and has nowhere to live here.
    const complaint = await createComplaint({
      ...validSubmission,
      severity: 4,
      aiNote: "Escalated by keyword.",
      source: "fallback",
      confidence: 0.5,
    });
    expect(complaint.severity).toBe(4);
    expect(complaint.aiNote).toBe("Escalated by keyword.");
    expect(complaint.source).toBe("fallback");
    expect(complaint).not.toHaveProperty("confidence");
  });
});

// ---------------------------------------------------------------------------
// Demo seeding — the records every other behaviour is measured against
// ---------------------------------------------------------------------------
describe("ensureSeeded", () => {
  it("injects three demo complaints with sequential ids on a fresh store", async () => {
    await ensureSeeded();
    const list = await listComplaints();
    expect(list).toHaveLength(3);
    expect(list.map((c) => c.id)).toEqual([
      `CP-${WARD_ID}-0001`,
      `CP-${WARD_ID}-0002`,
      `CP-${WARD_ID}-0003`,
    ]);
    expect(list.every((c) => c.demo === true)).toBe(true);
    expect(nextComplaintId(await listComplaints())).toBe(`CP-${WARD_ID}-0004`);
  });

  it("is guarded by the seeded flag and runs only once", async () => {
    await ensureSeeded();
    localStorage.removeItem("civicpulse:complaints");
    await ensureSeeded();
    expect(await listComplaints()).toEqual([]);
  });

  it("does not seed over a store that already has complaints", async () => {
    await createComplaint(validSubmission);
    await ensureSeeded();
    expect(await listComplaints()).toHaveLength(1);
    expect((await listComplaints())[0].demo).toBe(false);
  });

  it("gives demo complaints a deterministic fallback severity and no photo", async () => {
    await ensureSeeded();
    for (const c of await listComplaints()) {
      expect(c.source).toBe("fallback");
      expect(c.severity).toBeGreaterThanOrEqual(1);
      expect(c.severity).toBeLessThanOrEqual(5);
      expect(c.photo).toBeNull();
    }
  });
});
