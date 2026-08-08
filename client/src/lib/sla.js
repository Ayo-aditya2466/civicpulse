// CivicPulse — SLA arithmetic (deterministic, no prediction/ML)
// All SLA math lives here. Officer screens import from this module and never
// compute deadlines/urgency inline. Pure arithmetic over seed slaHours.

import { complaintTypes } from "../data/seed";
import { STATUS_FLOW } from "../config";

const HOUR_MS = 60 * 60 * 1000;
const FINAL_STATUS = STATUS_FLOW[STATUS_FLOW.length - 1]; // "Resolved"

function slaHoursForType(type) {
  return complaintTypes.find((c) => c.type === type)?.slaHours ?? null;
}

// Full SLA snapshot for a complaint at time `now` (default Date.now()).
// levels: "resolved" | "overdue" | "due-soon" | "on-track"
export function slaFor(complaint, now = Date.now()) {
  const slaHours = slaHoursForType(complaint.type);
  const deadline =
    slaHours != null ? complaint.createdAt + slaHours * HOUR_MS : null;
  const remainingMs = deadline != null ? deadline - now : null;

  let level;
  if (complaint.status === FINAL_STATUS) {
    level = "resolved";
  } else if (remainingMs == null) {
    level = "on-track";
  } else if (remainingMs < 0) {
    level = "overdue";
  } else if (remainingMs < slaHours * HOUR_MS * 0.25) {
    level = "due-soon";
  } else {
    level = "on-track";
  }

  return { slaHours, deadline, remainingMs, level };
}

// Human-readable remaining/overdue label, e.g. "8h 20m left" / "3h 5m overdue".
export function formatRemaining(remainingMs) {
  if (remainingMs == null) return "—";
  const overdue = remainingMs < 0;
  let mins = Math.floor(Math.abs(remainingMs) / (60 * 1000));
  const days = Math.floor(mins / (60 * 24));
  mins -= days * 60 * 24;
  const hours = Math.floor(mins / 60);
  mins -= hours * 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days) parts.push(`${mins}m`); // omit minutes once we're days out
  const body = parts.join(" ");
  return overdue ? `${body} overdue` : `${body} left`;
}

// Urgency sort key: overdue first (most negative remaining first), resolved
// always last. Lower number = more urgent.
export function urgencyRank(complaint, now = Date.now()) {
  const { level, remainingMs } = slaFor(complaint, now);
  if (level === "resolved") return Number.POSITIVE_INFINITY;
  return remainingMs == null ? Number.MAX_SAFE_INTEGER : remainingMs;
}
