// CivicPulse — tests for the ComplaintEvent append-only log (M7)
//
// Covers: CREATED / STATUS_CHANGED recording, per-complaint seq ordering
// (including colliding timestamps), append-only behaviour, the strict-
// propagate failure contract (including partial failure AFTER the complaint
// itself is saved), and the compatibility requirement that complaint.history
// keeps being written unchanged.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createComplaint,
  advanceStatus,
  listComplaints,
  getComplaint,
} from "./complaints";
import { listEvents, listEventsFor, appendEvent } from "./complaintEvents";
import { STATUS_FLOW } from "../config";

const HOUR_MS = 60 * 60 * 1000;
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
// CREATED
// ---------------------------------------------------------------------------
describe("CREATED event", () => {
  it("is recorded when a complaint is created", async () => {
    const complaint = await createComplaint(validSubmission);
    const events = await listEventsFor(complaint.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("CREATED");
  });

  it("carries the correct complaintId, actor, timestamp and seq", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const complaint = await createComplaint(validSubmission);
      const [event] = await listEventsFor(complaint.id);
      expect(event.complaintId).toBe(complaint.id);
      expect(event.actor).toBe("citizen");
      expect(event.at).toBe(NOW);
      expect(event.seq).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// STATUS_CHANGED
// ---------------------------------------------------------------------------
describe("STATUS_CHANGED event", () => {
  it("is recorded with from/to when a complaint advances", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const complaint = await createComplaint(validSubmission);
      vi.setSystemTime(NOW + HOUR_MS);
      await advanceStatus(complaint.id);
      const events = await listEventsFor(complaint.id);
      expect(events).toHaveLength(2);
      expect(events[1]).toMatchObject({
        complaintId: complaint.id,
        type: "STATUS_CHANGED",
        actor: "officer",
        from: "Submitted",
        to: "Assigned",
      });
      expect(events[1].at).toBe(NOW + HOUR_MS);
      expect(events[1].seq).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("records nothing for the no-op paths (unknown id, final status, unknown status)", async () => {
    const complaint = await createComplaint(validSubmission);
    await advanceStatus("CP-W6-9999");
    await advanceStatus(complaint.id);
    await advanceStatus(complaint.id);
    await advanceStatus(complaint.id); // now Resolved
    await advanceStatus(complaint.id); // no-op on final
    const events = await listEventsFor(complaint.id);
    // CREATED + exactly three transitions; the no-ops appended nothing.
    expect(events.map((e) => e.type)).toEqual([
      "CREATED",
      "STATUS_CHANGED",
      "STATUS_CHANGED",
      "STATUS_CHANGED",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Append-only and ordering
// ---------------------------------------------------------------------------
describe("append-only log", () => {
  it("appends rather than replacing previous events", async () => {
    const a = await createComplaint(validSubmission);
    const b = await createComplaint(validSubmission);
    await advanceStatus(a.id);
    const all = await listEvents();
    expect(all).toHaveLength(3);
    expect(await listEventsFor(a.id)).toHaveLength(2);
    expect(await listEventsFor(b.id)).toHaveLength(1);
  });

  it("orders same-timestamp events by per-complaint seq", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const complaint = await createComplaint(validSubmission);
      // Two transitions at the identical instant — only seq separates them.
      await advanceStatus(complaint.id);
      await advanceStatus(complaint.id);
      const events = await listEventsFor(complaint.id);
      expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
      expect(events[1].at).toBe(events[2].at);
      expect(events[1].seq).toBeLessThan(events[2].seq);
    } finally {
      vi.useRealTimers();
    }
  });

  it("numbers seq per complaint, not globally", async () => {
    const a = await createComplaint(validSubmission);
    const b = await createComplaint(validSubmission);
    expect((await listEventsFor(b.id))[0].seq).toBe(1);
    expect((await listEventsFor(a.id))[0].seq).toBe(1);
  });

  it("assigns seq itself — a caller cannot drift it", async () => {
    const stored = await appendEvent({
      complaintId: "CP-W6-0001",
      type: "CREATED",
      actor: "citizen",
      at: NOW,
      seq: 99, // deliberately wrong; appendEvent must overwrite it
    });
    expect(stored.seq).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Failure contract (strict-propagate)
// ---------------------------------------------------------------------------
describe("write failure", () => {
  it("rejects appendEvent rather than claiming success", async () => {
    refuseWrites();
    await expect(
      appendEvent({ complaintId: "CP-W6-0001", type: "CREATED", actor: "citizen", at: NOW }),
    ).rejects.toThrow(/storage write failed/);
  });

  it("rejects createComplaint when the EVENT write fails after the complaint is saved", async () => {
    // Partial failure: only the events key refuses; every other write must go
    // through to the REAL setItem, so the mock delegates instead of replacing.
    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (String(key).includes("complaintEvents")) {
        throw new Error("QuotaExceededError");
      }
      realSetItem(key, value);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createComplaint(validSubmission)).rejects.toThrow(
      /storage write failed/,
    );
    // The complaint row itself was committed before the failure — that is the
    // documented consequence of strict-propagate, not a silent success.
    expect(await listComplaints()).toHaveLength(1);
  });

  it("rejects advanceStatus when the event write fails, leaving status unchanged", async () => {
    const complaint = await createComplaint(validSubmission);
    vi.restoreAllMocks();
    refuseWrites();
    await expect(advanceStatus(complaint.id)).rejects.toThrow(
      /storage write failed/,
    );
    vi.restoreAllMocks();
    expect((await getComplaint(complaint.id)).status).toBe(STATUS_FLOW[0]);
  });
});

// ---------------------------------------------------------------------------
// Compatibility: history keeps working exactly as before
// ---------------------------------------------------------------------------
describe("complaint.history compatibility", () => {
  it("history is still written and unchanged in shape alongside events", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const complaint = await createComplaint(validSubmission);
      expect(complaint.history).toEqual([
        { status: "Submitted", at: NOW },
      ]);

      vi.setSystemTime(NOW + HOUR_MS);
      await advanceStatus(complaint.id);
      const stored = await getComplaint(complaint.id);
      expect(stored.history).toEqual([
        { status: "Submitted", at: NOW },
        { status: "Assigned", at: NOW + HOUR_MS },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
