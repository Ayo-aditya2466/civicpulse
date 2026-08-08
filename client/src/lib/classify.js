// CivicPulse — complaint severity classification (M3 AI layer)
//
// classifyComplaint() asks the proxy (which calls Gemini) for a severity
// assessment, with a hard 3s timeout. On ANY failure — proxy down, non-2xx,
// timeout, or an invalid response shape — it silently returns a deterministic
// keyword-based fallback with the SAME output shape. It never throws, so the
// citizen sees no error state and no difference between the two paths.
//
// Output shape (both paths):
//   { severity: 1-5, aiNote: string, confidence: 0-1, source: "ai"|"fallback" }
//
// This module NEVER decides the complaint TYPE (citizen-selected) and never
// sees the API key — the key stays server-side in proxy/server.js.

import { PROXY_BASE_URL } from "../config";

const TIMEOUT_MS = 3000;

// Baseline severity per complaint type (deterministic, explainable).
const TYPE_BASELINE = {
  Pothole: 2,
  "Water Leakage": 3,
  "Garbage Collection": 2,
  "Drainage Blockage": 3,
  Streetlight: 2,
};

// Keywords that escalate severity, grouped by the bump they apply.
const ESCALATORS = [
  {
    bump: 2,
    words: [
      "burst",
      "flood",
      "flooding",
      "sewage",
      "overflow",
      "collapse",
      "collapsed",
      "electric",
      "live wire",
      "shock",
      "injury",
      "injured",
      "accident",
      "emergency",
      "danger",
      "dangerous",
    ],
  },
  {
    bump: 1,
    words: [
      "child",
      "children",
      "school",
      "hospital",
      "elderly",
      "days",
      "week",
      "weeks",
      "blocked",
      "overflowing",
      "contaminated",
      "smell",
      "disease",
      "mosquito",
      "night",
    ],
  },
];

const clamp = (n) => Math.max(1, Math.min(5, n));

// Deterministic keyword/rule-based severity. Same input → same output.
export function fallbackClassify({ type, description }) {
  const base = TYPE_BASELINE[type] ?? 2;
  const text = String(description || "").toLowerCase();

  let severity = base;
  const hits = [];
  for (const group of ESCALATORS) {
    const matched = group.words.filter((w) => text.includes(w));
    if (matched.length) {
      severity += group.bump;
      hits.push(...matched);
    }
  }
  severity = clamp(severity);

  const aiNote = hits.length
    ? `Baseline severity for ${type}, raised by: ${[...new Set(hits)]
        .slice(0, 4)
        .join(", ")}.`
    : `Baseline severity for ${type}; no escalating factors detected.`;

  return { severity, aiNote, confidence: 0.5, source: "fallback" };
}

// Try the real AI path; fall back deterministically on any problem.
export async function classifyComplaint({ type, description }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${PROXY_BASE_URL}/classify`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, description }),
    });

    if (!res.ok) return fallbackClassify({ type, description });

    const data = await res.json();
    const severity = Number(data?.severity);
    const reasoning = data?.reasoning;

    // Validate shape; anything off → fallback.
    if (
      !Number.isInteger(severity) ||
      severity < 1 ||
      severity > 5 ||
      typeof reasoning !== "string" ||
      !reasoning.trim()
    ) {
      return fallbackClassify({ type, description });
    }

    let confidence = Number(data?.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.8;
    }

    return {
      severity,
      aiNote: reasoning.trim(),
      confidence,
      source: "ai",
    };
  } catch {
    // fetch rejection or AbortController timeout (>3s)
    return fallbackClassify({ type, description });
  } finally {
    clearTimeout(timer);
  }
}
