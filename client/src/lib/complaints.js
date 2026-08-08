// CivicPulse — complaints domain layer
// The ONLY place complaint operational data is created/read. Backed by the M0
// localStorage helper and M0 seed values. Contains no personal fields — those
// live entirely in contacts.js. Officer/field code (M2) imports this module.

import {
  STORAGE_KEYS,
  STATUS_FLOW,
  COMPLAINT_ID_PREFIX,
  DUPLICATE_WINDOW_HOURS,
} from "../config";
import { wards, complaintTypes } from "../data/seed";
import { readStore, writeStore } from "./storage";
import { fallbackClassify } from "./classify";

const WARD_ID = wards[0].id;
const HOUR_MS = 60 * 60 * 1000;

function deptForType(type) {
  return complaintTypes.find((c) => c.type === type)?.dept ?? null;
}

function loadAll() {
  return readStore(STORAGE_KEYS.complaints, []);
}

function saveAll(list) {
  writeStore(STORAGE_KEYS.complaints, list);
}

// --- IDs -------------------------------------------------------------------
// Format: CP-W14-0001. Sequence = (max existing sequence) + 1.
function seqOf(id) {
  const n = parseInt(String(id).split("-").pop(), 10);
  return Number.isFinite(n) ? n : 0;
}

export function nextComplaintId(list = loadAll()) {
  const max = list.reduce((m, c) => Math.max(m, seqOf(c.id)), 0);
  const seq = String(max + 1).padStart(4, "0");
  return `${COMPLAINT_ID_PREFIX}-${WARD_ID}-${seq}`;
}

// --- Reads -----------------------------------------------------------------
export function listComplaints() {
  return loadAll();
}

export function getComplaint(id) {
  return loadAll().find((c) => c.id === id) ?? null;
}

// --- Create ----------------------------------------------------------------
// Operational fields only. No name/phone/email accepted or stored here.
// severity/aiNote/source are additive (M3): the AI/fallback assessment. They
// are optional so older records without them remain valid.
export function createComplaint({
  type,
  street,
  description,
  photo,
  severity = null,
  aiNote = null,
  source = null,
}) {
  const list = loadAll();
  const now = Date.now();
  const complaint = {
    id: nextComplaintId(list),
    type,
    dept: deptForType(type),
    wardId: WARD_ID,
    street,
    description,
    photo, // resized JPEG data URL
    status: STATUS_FLOW[0],
    demo: false,
    createdAt: now,
    updatedAt: now,
    history: [{ status: STATUS_FLOW[0], at: now }],
    // AI assessment (officer-only display). source is for our debugging.
    severity,
    aiNote,
    source,
  };
  list.push(complaint);
  saveAll(list);
  return complaint;
}

// --- Status transitions (officer, M2) --------------------------------------
// Move a complaint one step forward through STATUS_FLOW, appending to history
// using the same { status, at } shape M1 writes — so the citizen-side
// StatusTimeline reflects officer changes automatically (same store). No-op
// once the complaint has reached the final status.
export function advanceStatus(id) {
  const list = loadAll();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const current = list[idx];
  const pos = STATUS_FLOW.indexOf(current.status);
  if (pos < 0 || pos >= STATUS_FLOW.length - 1) return current; // already final
  const nextStatus = STATUS_FLOW[pos + 1];
  const at = Date.now();
  const updated = {
    ...current,
    status: nextStatus,
    updatedAt: at,
    history: [...current.history, { status: nextStatus, at }],
  };
  list[idx] = updated;
  saveAll(list);
  return updated;
}

// --- Duplicate suggestion (deterministic simulation) -----------------------
// Same street + same type within the recent window. No NLP/embeddings/Gemini.
export function findDuplicates({ type, street }) {
  const cutoff = Date.now() - DUPLICATE_WINDOW_HOURS * HOUR_MS;
  return loadAll()
    .filter((c) => c.type === type && c.street === street && c.createdAt >= cutoff)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// --- Demo seed -------------------------------------------------------------
// Clearly synthetic complaints so the duplicate prompt reliably fires on a
// fresh run. Uses only M0 seed values, no contact info, same store as real
// submissions. Timestamps are relative to load time to stay inside the window.
function buildDemoComplaints() {
  const now = Date.now();
  const base = [
    { type: "Pothole", street: "Kaman Bhiwandi Road", agoH: 48, status: "Assigned",
      description: "Large pothole near the junction, worsening after rain." },
    { type: "Garbage Collection", street: "Golani Naka", agoH: 6, status: "Submitted",
      description: "Garbage not collected for three days at the market corner." },
    { type: "Water Leakage", street: "Anjur Phata", agoH: 24, status: "In Progress",
      description: "Continuous water leakage from the main pipeline on the roadside." },
  ];

  return base.map((d, i) => {
    const createdAt = now - d.agoH * HOUR_MS;
    const reached = STATUS_FLOW.slice(0, STATUS_FLOW.indexOf(d.status) + 1);
    const step = d.agoH / reached.length;
    const history = reached.map((status, idx) => ({
      status,
      at: Math.round(createdAt + idx * step * HOUR_MS),
    }));
    // Deterministic severity via the fallback classifier (no Gemini call).
    const { severity, aiNote, source } = fallbackClassify({
      type: d.type,
      description: d.description,
    });
    return {
      id: `${COMPLAINT_ID_PREFIX}-${WARD_ID}-${String(i + 1).padStart(4, "0")}`,
      type: d.type,
      dept: deptForType(d.type),
      wardId: WARD_ID,
      street: d.street,
      description: d.description,
      photo: null,
      status: d.status,
      demo: true,
      createdAt,
      updatedAt: history[history.length - 1].at,
      history,
      severity,
      aiNote,
      source,
    };
  });
}

// Inject demo complaints once (guarded by a flag so a real fresh run seeds,
// but we never clobber a store the citizen has already added to).
export function ensureSeeded() {
  if (readStore(STORAGE_KEYS.seeded, false)) return;
  const list = loadAll();
  if (list.length === 0) {
    saveAll(buildDemoComplaints());
  }
  writeStore(STORAGE_KEYS.seeded, true);
}
