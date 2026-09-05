// CivicPulse — CHARACTERIZATION tests for lib/sla.js
//
// SLA behaviour today is pure arithmetic over the prototype slaHours in seed.js:
// deadline = createdAt + slaHours, and four levels derived from what remains.
// Thresholds are computed FROM seed.js rather than hardcoded, so changing a
// prototype SLA value does not produce a wall of unrelated failures. The values
// themselves are prototype values and are not asserted to be correct policy.

import { describe, it, expect } from "vitest";
import { slaFor, formatRemaining, urgencyRank } from "./sla";
import { complaintTypes } from "../data/seed";
import { STATUS_FLOW } from "../config";

const HOUR_MS = 60 * 60 * 1000;
const CREATED = new Date("2026-03-01T00:00:00.000Z").getTime();
const DUE_SOON_FRACTION = 0.25; // lib/sla.js: remaining < 25% of the window

const slaHoursFor = (type) => complaintTypes.find((c) => c.type === type).slaHours;

const complaint = (type, status = "Submitted") => ({
  type,
  status,
  createdAt: CREATED,
});

// now = the instant at which `remaining` milliseconds are left before deadline.
const whenRemaining = (type, remainingMs) =>
  CREATED + slaHoursFor(type) * HOUR_MS - remainingMs;

describe("slaFor", () => {
  it("reads slaHours for each type straight from seed.js", () => {
    for (const entry of complaintTypes) {
      expect(slaFor(complaint(entry.type), CREATED).slaHours).toBe(entry.slaHours);
    }
  });

  it("keeps the current prototype SLA values", () => {
    expect(
      Object.fromEntries(complaintTypes.map((c) => [c.type, c.slaHours])),
    ).toEqual({
      Pothole: 72,
      "Water Leakage": 24,
      "Garbage Collection": 12,
      "Drainage Blockage": 12,
      Streetlight: 24,
    });
  });

  it("computes deadline as createdAt + slaHours", () => {
    const { deadline } = slaFor(complaint("Pothole"), CREATED);
    expect(deadline).toBe(CREATED + 72 * HOUR_MS);
  });

  it("computes remainingMs as deadline - now", () => {
    const now = CREATED + 10 * HOUR_MS;
    const { remainingMs } = slaFor(complaint("Water Leakage"), now);
    expect(remainingMs).toBe(CREATED + 24 * HOUR_MS - now);
  });

  it("defaults now to the current clock when not supplied", () => {
    const { remainingMs } = slaFor({
      type: "Pothole",
      status: "Submitted",
      createdAt: Date.now(),
    });
    expect(remainingMs).toBeLessThanOrEqual(72 * HOUR_MS);
    expect(remainingMs).toBeGreaterThan(71 * HOUR_MS);
  });

  describe("the four levels", () => {
    it("is on-track with more than 25% of the window left", () => {
      const type = "Pothole";
      const remaining = slaHoursFor(type) * HOUR_MS * (DUE_SOON_FRACTION + 0.1);
      expect(slaFor(complaint(type), whenRemaining(type, remaining)).level).toBe(
        "on-track",
      );
    });

    it("is due-soon with less than 25% of the window left", () => {
      const type = "Pothole";
      const remaining = slaHoursFor(type) * HOUR_MS * (DUE_SOON_FRACTION - 0.1);
      expect(slaFor(complaint(type), whenRemaining(type, remaining)).level).toBe(
        "due-soon",
      );
    });

    it("is overdue once remaining goes negative", () => {
      const now = CREATED + 73 * HOUR_MS;
      const snapshot = slaFor(complaint("Pothole"), now);
      expect(snapshot.remainingMs).toBeLessThan(0);
      expect(snapshot.level).toBe("overdue");
    });

    it("is resolved whenever the status is the final status", () => {
      expect(STATUS_FLOW[STATUS_FLOW.length - 1]).toBe("Resolved");
      expect(slaFor(complaint("Pothole", "Resolved"), CREATED).level).toBe(
        "resolved",
      );
    });

    it("reports resolved in preference to overdue on a late-but-closed complaint", () => {
      const snapshot = slaFor(
        complaint("Pothole", "Resolved"),
        CREATED + 500 * HOUR_MS,
      );
      expect(snapshot.remainingMs).toBeLessThan(0);
      expect(snapshot.level).toBe("resolved");
    });
  });

  describe("boundaries", () => {
    it("treats exactly 25% remaining as on-track, not due-soon", () => {
      const type = "Pothole";
      const remaining = slaHoursFor(type) * HOUR_MS * DUE_SOON_FRACTION;
      expect(slaFor(complaint(type), whenRemaining(type, remaining)).level).toBe(
        "on-track",
      );
    });

    it("treats one millisecond under 25% as due-soon", () => {
      const type = "Pothole";
      const remaining = slaHoursFor(type) * HOUR_MS * DUE_SOON_FRACTION - 1;
      expect(slaFor(complaint(type), whenRemaining(type, remaining)).level).toBe(
        "due-soon",
      );
    });

    it("treats the deadline instant itself as due-soon, not overdue", () => {
      const snapshot = slaFor(complaint("Pothole"), CREATED + 72 * HOUR_MS);
      expect(snapshot.remainingMs).toBe(0);
      expect(snapshot.level).toBe("due-soon");
    });

    it("treats one millisecond past the deadline as overdue", () => {
      expect(slaFor(complaint("Pothole"), CREATED + 72 * HOUR_MS + 1).level).toBe(
        "overdue",
      );
    });
  });

  it("returns nulls and on-track for a type with no SLA policy", () => {
    const snapshot = slaFor(complaint("Not A Type"), CREATED);
    expect(snapshot).toEqual({
      slaHours: null,
      deadline: null,
      remainingMs: null,
      level: "on-track",
    });
  });

  it("still reports resolved for an unknown type once closed", () => {
    expect(slaFor(complaint("Not A Type", "Resolved"), CREATED).level).toBe(
      "resolved",
    );
  });
});

describe("formatRemaining", () => {
  const ms = ({ d = 0, h = 0, m = 0 }) => ((d * 24 + h) * 60 + m) * 60 * 1000;

  it("renders an em dash for a null input", () => {
    expect(formatRemaining(null)).toBe("—");
  });

  it("renders hours and minutes left", () => {
    expect(formatRemaining(ms({ h: 8, m: 20 }))).toBe("8h 20m left");
  });

  it("renders minutes only under an hour", () => {
    expect(formatRemaining(ms({ m: 45 }))).toBe("45m left");
  });

  it("renders zero remaining as 0m left", () => {
    expect(formatRemaining(0)).toBe("0m left");
  });

  it("renders a negative value as overdue", () => {
    expect(formatRemaining(-ms({ h: 3, m: 5 }))).toBe("3h 5m overdue");
  });

  it("drops minutes once the value is a day or more", () => {
    expect(formatRemaining(ms({ d: 2, h: 3 }))).toBe("2d 3h left");
    expect(formatRemaining(ms({ d: 1, m: 30 }))).toBe("1d left");
  });

  it("omits a zero hours segment", () => {
    expect(formatRemaining(ms({ d: 1 }))).toBe("1d left");
  });
});

describe("urgencyRank", () => {
  it("returns remainingMs so that lower is more urgent", () => {
    const now = CREATED + 10 * HOUR_MS;
    expect(urgencyRank(complaint("Pothole"), now)).toBe(
      slaFor(complaint("Pothole"), now).remainingMs,
    );
  });

  it("is negative for an overdue complaint", () => {
    expect(urgencyRank(complaint("Pothole"), CREATED + 90 * HOUR_MS)).toBeLessThan(0);
  });

  it("puts a resolved complaint last with positive infinity", () => {
    expect(urgencyRank(complaint("Pothole", "Resolved"), CREATED)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("ranks a complaint with no SLA policy just before resolved ones", () => {
    expect(urgencyRank(complaint("Not A Type"), CREATED)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("sorts overdue first, then due-soon, then on-track, then resolved", () => {
    const now = CREATED + 100 * HOUR_MS;
    const overdue = { type: "Pothole", status: "Submitted", createdAt: CREATED };
    const dueSoon = {
      type: "Pothole",
      status: "Assigned",
      createdAt: now - 60 * HOUR_MS,
    };
    const onTrack = { type: "Pothole", status: "Submitted", createdAt: now };
    const resolved = { type: "Pothole", status: "Resolved", createdAt: CREATED };

    const order = [resolved, onTrack, overdue, dueSoon]
      .sort((a, b) => urgencyRank(a, now) - urgencyRank(b, now))
      .map((c) => slaFor(c, now).level);

    expect(order).toEqual(["overdue", "due-soon", "on-track", "resolved"]);
  });
});
