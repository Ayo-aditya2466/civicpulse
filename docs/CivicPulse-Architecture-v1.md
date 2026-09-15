# CivicPulse — Post-M4 Architecture / Multi-Agent Implementation Plan

**Document:** `docs/CivicPulse-Architecture-v1.md` · **Status:** M5 foundation — architecture only, no
implementation · **Date:** 2026-09-01

**Relationship to the master plan.** This is an **explicitly labelled extension** of
[`CivicPulse-Master-Plan-v2.md`](./CivicPulse-Master-Plan-v2.md), which remains the source of truth
for research direction, the multi-agent concept, and system scope. Nothing in the master plan is
deleted, replaced, or rewritten. Where this document makes a concrete choice, it cites the master-plan
section it implements (see §12).

**What this document is.** The architectural target and the contracts needed to build toward it. It
defines roles, permissions, the complaint lifecycle, domain entities, the seven agent contracts, the
shared-state model, the data strategy while municipal data is pending, and the localStorage→Supabase
migration path.

**What this document is not.** It is not a claim about what is built. §1 is an audit of the actual
M0–M4 code and is deliberately blunt about the gap between the prototype and the target.

---

## 0. How to read this document

Every capability in this document carries one of three markers:

| Marker | Meaning |
|---|---|
| **BUILT** | Exists in the M0–M4 code today, verified by reading the source |
| **BUILDABLE** | Can be built now, with no municipal pilot data |
| **BLOCKED** | Requires real BWCMC data before it can be built or honestly evaluated |

A fourth marker, **PROTOTYPE-ONLY**, marks something that exists but is explicitly not the intended
final mechanism and will be replaced.

---

## 1. Where the build actually stands (M0–M4 audit)

### 1.1 What exists, verified in code

**Storage.** `lib/storage.js` — a thin namespaced (`civicpulse:`) JSON wrapper over `localStorage`
(`readStore` / `writeStore` / `removeStore`), with no domain logic. **PROTOTYPE-ONLY.**

**Two separate stores**, per `config.js` `STORAGE_KEYS`: `complaints` (operational),
`contacts` (citizen personal data), and a `seeded` flag.

**Domain layer.** `lib/complaints.js` is the only module that creates or reads operational complaint
data: `nextComplaintId`, `listComplaints`, `getComplaint`, `createComplaint`, `advanceStatus`,
`findDuplicates`, `ensureSeeded`. IDs are `CP-<ward>-<0000>` from `max(existing seq) + 1`.

**The actual complaint record** written by `createComplaint`:

```
{ id, type, dept, wardId, street, description, photo,
  status, demo, createdAt, updatedAt,
  history: [{ status, at }],
  severity, aiNote, source }
```

Three things about this shape matter architecturally:

- It contains **no citizen identity field of any kind**. Privacy is enforced by shape, not by policy.
- It has **no coordinates**. `street` is a name; the officer map derives a pin from
  `data/streetCoords.js`, whose own header states the values are hand-placed and not surveyed.
- AI output (`severity`, `aiNote`, `source`) is stored **inline and unversioned** — one assessment per
  complaint, overwritten in place if re-run. **PROTOTYPE-ONLY** (see §5, `AgentResult`).

**Contacts.** `lib/contacts.js` keys personal data by complaint ID in the separate `contacts` store.
Anonymous submissions create **no record at all** (`saveContact` returns `false` when every field is
blank). No officer-side module imports it. **BUILT.**

**SLA.** `lib/sla.js` — deterministic arithmetic, no prediction. `slaFor()` returns
`{ slaHours, deadline, remainingMs, level }` where `deadline = createdAt + slaHours × 3600000` and
`level ∈ {resolved, overdue, due-soon, on-track}`; `due-soon` triggers below 25 % of the window.
`urgencyRank()` sorts the officer queue. This is **operational truth and stays that way** (§7.5).

**AI severity.** `lib/classify.js` calls the proxy with a 3 s `AbortController`; `ReportPage` wraps
that in a 4 s `Promise.race` ceiling. Any failure — non-2xx, bad shape, timeout, dead network — returns
`fallbackClassify()`, a keyword-escalator rule over a per-type baseline, with an **identical output
shape** `{ severity, aiNote, confidence, source }`. The citizen never sees a difference. **BUILT** —
and this failure pattern is the template every agent in §7 follows.

**Proxy.** `proxy/server.js` — Express, `/health`, `/test-gemini`, `POST /classify`. The Gemini key is
read server-side only, with an 8 s upstream abort and strict validation of the model's JSON. CORS is
env-driven (`ALLOWED_ORIGIN`). **BUILT.**

**Duplicate suggestion.** `findDuplicates({ type, street })` — same type **and** same street within
`DUPLICATE_WINDOW_HOURS` (168 h), newest first, shown to the citizen *before* submit via
`DuplicateNotice`. This is deliberately Layer 1 of master plan §2.1, matching FixMyStreet's approach.
**BUILT**, and it stays.

**Department routing.** `deptForType()` — a lookup in `data/seed.js` `complaintTypes`. Deterministic
type → department, with per-type SLA hours. **BUILT** (routing) / **BLOCKED** (the taxonomy itself).

**Status flow.** `STATUS_FLOW = [Submitted, Assigned, In Progress, Resolved]`. `advanceStatus()` moves
exactly one step forward and appends `{ status, at }`. There is no backward transition, no rejection,
no reopen, no assignment to a person. **PROTOTYPE-ONLY** (see §4).

**Surfaces.** Landing role-selector (placeholder, no auth) → citizen (`/report`, `/confirmation/:id`,
`/track`, `/track/:id`) and officer (`/officer`, `/officer/:id`, list + filter + urgency sort + Leaflet
map). Officer identity is a display-only string from `seed.officers[0]`.

**Deployment.** Client → Vercel (`vercel.json` SPA rewrite, `VITE_PROXY_BASE_URL`); proxy → Render
(`GEMINI_API_KEY`, `ALLOWED_ORIGIN`). No secret or deployed URL in source. **BUILT.**

### 1.2 Lifecycle coverage — the honest gap

Against the intended lifecycle, M0–M4 implements the two ends and almost none of the middle:

| Lifecycle stage | Status | What actually exists |
|---|---|---|
| Submit complaint | **BUILT** | Form + photo + ID issuance |
| Intake / validation | partial | Form-level required-field checks only; no validation agent, no spam/quality/photo checks |
| Classification | **not built** | The citizen picks the type; nothing classifies text |
| Department routing | **BUILT** | Deterministic `type → dept` lookup |
| Severity assessment | **BUILT** | Gemini + deterministic fallback, **text only** — no CV |
| Duplicate assessment | **BUILT** (Layer 1) | Rule-based street + type + 7 d; no GPS radius, no semantics |
| SLA risk assessment | **not built** | Deterministic countdown only — a countdown is not a prediction |
| Department manager step | **not built** | No manager role exists |
| Worker assignment | **not built** | No worker, no `Assignment` entity |
| Worker performs work | **not built** | — |
| Resolution evidence | **not built** | No evidence upload, no `ResolutionEvidence` entity |
| Verification | **not built** | "Resolved" is a status an officer sets unilaterally |
| Citizen sees resolution | partial | Sees status + timeline; no municipal response text, no evidence photo |

Two of the four current statuses are **collapsed composites**: today's `Submitted` covers submitted +
routed + awaiting-assignment, and today's `Resolved` covers work-complete + verified + resolved. §4.3
maps them out.

### 1.3 What remains prototype-only from M0–M4

| Prototype mechanism | Replaced by | Section |
|---|---|---|
| `localStorage` as the store | Supabase Postgres | §10 |
| Photos as resized JPEG data URLs (1024 px / q0.7) | Supabase Storage + signed URLs | §10 |
| Landing-page staff "login" (non-empty check) | Supabase Auth | §3, §10 |
| Officer identity from `seed.officers[0]` | `User` + `Role` | §3, §5 |
| Inline `severity`/`aiNote`/`source` on the complaint | versioned `AgentResult` rows | §5, §6 |
| Street name as the only location | optional GPS + asset reference | §5, open decision D1 |
| `demo: true` seeded records | real pilot data | §8 |
| 4-state linear flow | full state machine incl. reopen | §4 |
| Fixed `seed.js` taxonomy | municipal configuration | §5.3, §8 |

---

## 2. Target architecture

### 2.1 Four layers

```
┌─────────────────────────────────────────────────────────────┐
│ L1  PRESENTATION — role-scoped React surfaces               │
│     citizen · worker · manager · admin                      │
├─────────────────────────────────────────────────────────────┤
│ L2  OPERATIONAL CORE — authoritative, deterministic         │
│     complaint state machine · SLA truth · assignment        │
│     event log · permission enforcement                     │
├─────────────────────────────────────────────────────────────┤
│ L3  AGENT LAYER — advisory, replaceable, versioned          │
│     A1 intake · A2 classify/route · A3 severity             │
│     A4 duplicate · A5 SLA risk · A6 accountability          │
│     A7 policy insight                                       │
├─────────────────────────────────────────────────────────────┤
│ L4  PERSISTENCE — localStorage today → Supabase (Postgres,  │
│     Auth, RLS, Storage) later                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 The governing rule

> **Agents advise. The deterministic core and the human decide.**

Every consequence follows from this one rule:

1. **No agent mutates operational truth.** Agents write `AgentResult` rows. Status transitions,
   department assignment, SLA deadlines, and worker assignment are set by deterministic rules or by a
   human acting through L2.
2. **Every agent has a deterministic fallback** and an unconditional output contract (§6.4). An agent
   being down degrades advice quality; it never blocks a citizen or an officer. `classify.js` is the
   existing proof this works.
3. **Every agent output is explainable** — it carries the signals or features that produced it, not
   just a number. This is master plan pillar "explainability", and it is what makes an officer trust a
   severity of 5.
4. **Every agent is independently replaceable** because its contract is a function signature, not a
   position in a call chain. Swapping the A3 text model for a CV-augmented one changes no L2 code.
5. **Agent output is versioned and append-only**, which is the precondition for evaluating a new model
   against the one in production without destroying the comparison.

This is also the honest answer to "is this really multi-agent?" — yes, but they are specialist
components over shared state, not seven chatbots, and not seven LLM calls.

### 2.3 Runtime topology

| Component | Host | Responsibility | When |
|---|---|---|---|
| React client | Vercel | L1 + (today) L2 in-browser | now |
| Node/Express BFF | Render | L2 server-side, JS agents (A1, A2 baseline, A4 L1, A5 heuristic), Gemini proxy | M6+ |
| Python ML/CV services | separate | A3 CV, A4 embeddings, A5 gradient boosting | research phase |
| Supabase | managed | Postgres + Auth + RLS + Storage | data phase |

Python is a **specialist service tier**, reached over HTTP by the Node BFF. It does not replace the
React/Node application, and the app must remain fully functional when no Python service is reachable.

---

## 3. Human roles and permissions

Roles and agents are **orthogonal dimensions**. A role is *who may see and do what*. An agent is *what
computes an assessment*. No agent has a role; no role is an agent.

### 3.1 Role definitions

**CITIZEN** — submits complaints (anonymously if they choose), receives an ID, tracks their own
complaint's status and history, and eventually sees the municipal response and resolution evidence.
Never sees internal assessments: severity, AI reasoning, risk scores, or officer identity beyond the
responsible department. *(Established in M3 and preserved: `ConfirmationPage` has zero references to
`severity`/`aiNote`/`source`.)*

**WORKER** — field staff. Sees **only** complaints assigned to them, and only the fields needed to do
the physical work: complaint ID, category, location, description, photo, SLA due time. Updates their
own assignment status, uploads resolution evidence, adds work notes. Cannot browse the queue, cannot
see other workers' tasks, cannot reassign, cannot see any citizen identity.

**MANAGER** — department-level. Sees complaints routed to their own department, prioritises and filters
them, assigns to workers under them, monitors progress, reviews and verifies resolutions, sees
department workload and agent advice (severity, duplicate candidates, SLA risk). Cannot see other
departments' operational detail. Cannot see any citizen identity.

**ADMIN** — municipality-level oversight: overall activity, department and SLA performance, workload,
recurring problems, hotspots, accountability findings, policy insights. Manages departments, users,
categories, and SLA configuration. **Also cannot see citizen identity** (§3.4).

### 3.2 Permission matrix

`C` create · `R` read · `U` update · `—` no access. Scope in parentheses.

| Resource | Citizen | Worker | Manager | Admin |
|---|---|---|---|---|
| Complaint (operational) | C, R (own) | R (assigned only, field subset) | R (own dept) | R (all) |
| Complaint status transition | — | U (own assignment steps only) | U (dept workflow steps) | U (override, audited) |
| **CitizenContact** | R (own) | **—** | **—** | **—** |
| Assignment | — | R, U (own) | C, R, U (own dept) | R (all) |
| ComplaintEvent | R (own, filtered) | C (own actions) | C, R (own dept) | R (all) |
| ResolutionEvidence | R (own complaint) | C, R (own assignment) | R + verify (own dept) | R (all) |
| AgentResult | **—** | — | R (own dept) | R (all) |
| Category / SLA config | R (public list) | R | R | C, R, U |
| User / Role | — | — | R (workers in own dept) | C, R, U |
| Accountability findings | — | — | R (own dept) | R (all) |
| Policy insights | — | — | R (dept-scoped) | R (municipality-wide) |

### 3.3 Department → Manager → Worker

Modelled as one `User` table with a role and two nullable references, **not** a separate `Worker`
table — a worker is a user with `role = worker`:

```
Department 1 ──── n User(role=manager)   [user.departmentId]
User(role=manager) 1 ──── n User(role=worker)   [user.managerId]
Complaint ──── departmentId  (set by deterministic routing)
Assignment ──── complaintId + assignedToUserId(worker) + assignedByUserId(manager)
```

Invariants the core enforces: a complaint may have at most one **active** assignment; a manager may
only assign to workers whose `managerId` is that manager; an assignment's department must match the
complaint's department. Reassignment closes the prior assignment rather than editing it, so the
history stays intact for A6.

### 3.4 Privacy architecture

The M1 principle holds and is strengthened: **no role in the operational hierarchy reads citizen
contact data — including admin.**

- **Today (enforced by shape + module boundary):** operational records have no identity fields;
  `contacts.js` is imported by citizen-side code only. Anonymous submissions store nothing at all.
- **Under Supabase (enforced structurally):** `citizen_contact` is a separate table with an RLS policy
  that denies `SELECT` to every operational role. Notifications are sent by a background service using
  the service role — it reads a phone number to dispatch a message and returns no identity to any UI.
  A human never sees the value.
- **Escalation/appeal**, if BWCMC requires a contactable path, is a separate audited flow with its own
  policy and an event log entry per access — never an ambient permission.

This directly implements master plan §2.5 (the Swachhata failure mode where routed contact details were
used to pressure complainants). It is also the honest version of the pitch line: not "we hide it in the
UI", but "the role cannot read the column."

---

## 4. Complaint lifecycle

### 4.1 Two different things are being conflated — separate them

The lifecycle as written mixes **automatic intake stages** (validation, classification, routing,
severity, duplicate, SLA risk — seconds) with **human operational states** (manager, worker, work,
verification — hours to days). They need different treatment:

```
INTAKE PIPELINE  (automatic, per submission)
  submission
    → A1 validate ─────────────► reject with reason, or accept
    → deterministic route (type → dept)
    → A2 classify (advisory: agrees / disagrees + confidence)
    → A3 severity   ┐
    → A4 duplicate  ├─ advisory, written as AgentResult
    → A5 SLA risk   ┘
  ↓
OPERATIONAL STATE MACHINE  (human-driven, audited)
```

### 4.2 Target state machine

| State | Meaning | Who advances it |
|---|---|---|
| `Submitted` | Accepted by intake, awaiting departmental triage | system |
| `Rejected` | Failed intake validation — terminal, always with a reason | system, manager can override |
| `Routed` | Visible in the department queue, no worker yet | system |
| `Assigned` | A worker has been assigned | manager |
| `In Progress` | The worker has started | worker |
| `Work Completed` | Evidence uploaded, awaiting verification | worker |
| `Verified` | Manager accepted the work | manager |
| `Resolved` | Closed as resolved; citizen notified | system on verify |
| `Reopened` | Citizen contested, or verification failed → back to `Assigned` | citizen / manager |
| `Closed` | Terminal after citizen confirmation or a confirmation timeout | system |

Legal transitions only; every transition writes a `ComplaintEvent` with actor, timestamp, and
from/to status. `Reopened` is **first-class**, not a flag — master plan §2.3 requires that a resolution
which gets reopened does not count as a clean resolution, which means it must be visible to A5's
training labels and A6's metrics.

### 4.3 Mapping from the current four states

| Current | Target equivalent |
|---|---|
| `Submitted` | `Submitted` + `Routed` (collapsed) |
| `Assigned` | `Assigned` (department-level; no worker identity today) |
| `In Progress` | `In Progress` |
| `Resolved` | `Work Completed` + `Verified` + `Resolved` (collapsed) |
| — | `Rejected`, `Reopened`, `Closed` do not exist today |

Migration is forward-only and lossless: existing records map to the target names above, and their
`history` array becomes `ComplaintEvent` rows with `actor = "prototype"`. No historical timestamp is
invented.

### 4.4 SLA clock semantics

The deterministic rule is unchanged and remains operational truth:

```
slaDueAt = createdAt + slaHours(category) × 3600000
```

Decisions this document fixes, because they are ambiguous today and affect A5's labels:

- **Measurement point:** SLA is measured to the **first** `Resolved`, not to `Closed`.
- **Reopen:** starts a **new SLA segment** with its own `slaDueAt`; the original breach/compliance
  record is retained. A complaint therefore has a list of SLA segments, not one deadline.
- **No pausing.** The clock does not stop for "awaiting material" or similar in Phase 2. If BWCMC's
  real process requires pause reasons, they become configurable, and the pause intervals become an A5
  feature rather than an untracked gap.
- **Configurability:** `slaHours` lives in `SlaPolicy` with an `effectiveFrom` date, so changing an SLA
  never retroactively rewrites whether past complaints breached.

---

## 5. Core domain entities

Architectural target. **Do not implement all of this at once** — §9 sequences it.

| Entity | Purpose | Today | Marker |
|---|---|---|---|
| `User` | identity + role + department + manager link | none (display string) | BLOCKED (auth) |
| `Role` | enum: citizen / manager / worker / admin | none | BUILDABLE |
| `Department` | organisational owner of categories and workers | 3 strings in `seed.js` | BLOCKED (real list) |
| `Category` | complaint type + default department + SLA | 5 objects in `seed.js` | BLOCKED (real taxonomy) |
| `Ward` | geographic/administrative unit | 1 object in `seed.js` | BLOCKED (real wards) |
| `Complaint` | the operational record — **no identity fields** | BUILT (partial shape) | BUILT |
| `CitizenContact` | personal data, separate store, keyed by complaint | BUILT | BUILT |
| `Assignment` | worker ← complaint, with lifecycle timestamps | none | BUILDABLE |
| `ComplaintEvent` | append-only audit log of everything that happened | partial (`history[]`) | BUILDABLE |
| `ResolutionEvidence` | proof-of-work photo + note | none | BUILDABLE |
| `AgentResult` | versioned, append-only agent output | inline fields | BUILDABLE |
| `SlaPolicy` | SLA hours per category/department, with effective date | inline `slaHours` | BUILDABLE |
| `Asset` | the road / streetlight / drain / bin the complaint is about | none | BLOCKED (asset register) |
| `AccountabilityFinding` | A6 output | none | BUILDABLE |
| `PolicyInsight` | A7 output | none | BLOCKED (volume) |

### 5.1 The entities that need field-level definition now

**`Complaint`** — extends today's shape; every addition is additive and nullable so existing records
stay valid (the same discipline M3 used for `severity`/`aiNote`/`source`):

```
id, wardId, categoryId, departmentId,
street, lat?, lng?, locationNote?, assetId?,
description, photoRef,
status, slaSegments[{ startedAt, slaHours, dueAt, closedAt?, breached? }],
createdAt, updatedAt,
sourceChannel: "citizen_web" | "officer_initiated" | "import",
reopenCount, currentAssignmentId?,
severityCache?, riskBandCache?          // denormalised from AgentResult for queries
```

`sourceChannel` exists specifically to support the officer-initiated entry path that master plan §2.4
requires so hotspot data is not purely a function of who complains. `severityCache` is a **cache** — the
authoritative record is the `AgentResult` row it was copied from.

**`AgentResult`** — the single most important new entity, and the reason agents are evaluable:

```
id, complaintId, agentKey, agentVersion,
output (json), confidence?, source: "rule" | "model" | "llm" | "fallback",
latencyMs, createdAt, notes[]
```

Append-only. Re-running A3 with a new model writes a **new row**; nothing is overwritten. This is what
makes "did the new model do better than the old one on the same complaints" answerable at all.

**`ComplaintEvent`** — `{ id, complaintId, type, actorUserId?, actorKind, at, fromStatus?, toStatus?, payload }`.
Append-only. This is the substrate A6 and A7 operate on; without it, accountability analysis has nothing
to read. Today's `history[]` is a four-entry subset of it.

**`ResolutionEvidence`** — `{ id, complaintId, assignmentId, photoRef, note?, capturedAt, uploadedByUserId, geo? }`.
Required before `Work Completed` is a legal transition.

### 5.2 Municipal configuration stays configurable

Everything in `data/seed.js` today — the one ward, six streets, three departments, five categories with
their SLA hours, two officer names — is **placeholder configuration**, not data. It becomes rows in
`Ward`, `Department`, `Category`, `SlaPolicy`, and `User` when BWCMC's real structure arrives. No agent
and no L2 rule may hardcode any of those values; they are read from configuration. `deptForType()` is
already the right shape for this — it reads a table rather than embedding a mapping.

---

## 6. Shared state and data flow

### 6.1 The model

```
                    ┌──────────────────────────────────┐
   submission ─────►│  Complaint  +  ComplaintEvent    │◄──── human actions (L2)
                    │        (shared state)            │
                    └───────┬──────────────────▲───────┘
                     reads  │                  │  writes AgentResult
                            ▼                  │
              ┌─────────────────────────────────────────┐
              │  A1  A2  A3  A4  A5   (per complaint)   │
              └─────────────────────────────────────────┘
                            │
                            ▼  advisory fields (cache) only
                    ┌──────────────────────────────────┐
                    │  SLA / operational state (L2)    │  ← authoritative
                    └───────┬──────────────────────────┘
                            ▼
                    human workflow: manager → worker → evidence → verify
                            │
                            ▼  accumulated history
              ┌─────────────────────────────────────────┐
              │  A6 accountability    A7 policy insight │  (aggregate, periodic)
              └─────────────────────────────────────────┘
```

A1–A5 are **per-complaint** and run on the intake pipeline or on a trigger. A6–A7 are **aggregate** and
run periodically over accumulated history. Neither group writes operational truth.

### 6.2 Agent read/write field matrix

| Agent | Reads | Writes |
|---|---|---|
| A1 Intake | description, photoRef, categoryId, street/ward, submission metadata (hashed) | `AgentResult(intake)`; `complaint.status → Rejected` **only** via an L2 rule acting on the result |
| A2 Classify/Route | description, citizen-selected categoryId, ward | `AgentResult(classification)`: category, confidence, department, `agreesWithCitizen` |
| A3 Severity | description, categoryId, photoRef | `AgentResult(severity)`: severity 1–5, confidence, reasoning, signals[]; caches to `complaint.severityCache` |
| A4 Duplicate | categoryId, street/lat/lng, createdAt window, description (+embedding) | `AgentResult(duplicate)`: candidates[{complaintId, score, reasons}], clusterId? |
| A5 SLA risk | complaint, slaSegments, assignment, department load aggregates, historical stats | `AgentResult(sla_risk)`: pBreach, riskBand, topFeatures[]; caches to `complaint.riskBandCache` |
| A6 Accountability | ComplaintEvent, Assignment, ResolutionEvidence, reopenCount | `AccountabilityFinding` rows |
| A7 Policy | aggregated complaints/events, geo, exposure denominators | `PolicyInsight` rows |

No agent writes another agent's fields. No agent writes `status`, `departmentId`, `slaSegments`, or any
assignment — those are L2's.

### 6.3 Orchestration and failure isolation

Two budgets, because a citizen must never wait on a model:

- **Synchronous fast path** (before the citizen sees their ID): A1 rules (< 50 ms), deterministic
  routing (< 5 ms), A4 Layer 1 pre-submit check (already built). Hard ceiling, no network dependency.
- **Asynchronous enrichment** (after acknowledgement): A3, A2's model, A4 Layer 2, A5's first score.
  The complaint exists and is queueable the moment it is accepted; advice arrives seconds later.

This is a deliberate change from M3, which blocks submit on the Gemini call behind a 4 s ceiling. The
ceiling was the right fix for a demo; async is the right architecture for a pilot. Recorded as open
decision **D5**.

Failure isolation rules: per-agent timeout, never-throw contract, missing advice renders as "not yet
assessed" rather than an error, and a failed agent never blocks a status transition.

### 6.4 The common agent contract

Every agent, whatever its method, exposes one shape:

```
run(input, ctx) → {
  ok: boolean,
  output: object | null,
  confidence: number | null,
  source: "rule" | "model" | "llm" | "fallback",
  agentKey: string, agentVersion: string,
  latencyMs: number,
  notes: string[]
}
```

It never throws, always returns within its timeout, and always reports which path produced the answer.
`classify.js` already satisfies this in spirit — same shape from Gemini and from the keyword fallback,
with `source` distinguishing them. Generalising it is the M5 refactor, not a rewrite.

---

## 7. The seven agent contracts

### 7.1 A1 — Intake & Validation · **BUILDABLE**

| | |
|---|---|
| **Responsibility** | Decide whether a submission is usable, and say why if not |
| **Input** | description, photoRef, categoryId, street/ward, submission metadata (hashed IP / rate window) |
| **Output** | `{ decision: accept \| flag \| reject, checks: [{ name, pass, detail }], qualityScore }` |
| **Method** | Deterministic rules — no ML. Required fields; description length and information content (rejects "asdasd", pure punctuation, single repeated token); photo checks (decodes, min dimensions, not a screenshot-of-text, blur via Laplacian variance later); location within a configured ward; spam via submission-rate window + blocklist + exact-text repeat |
| **Fallback** | On any internal error → `accept` with a `flag`. **A false reject is the expensive error**; never silently drop a citizen's real complaint |
| **Evaluation** | Precision/recall on a hand-labelled dev set of valid vs. junk submissions, with **false-reject rate as the headline metric** (target < 1 %). Rule-level hit counts to catch an over-firing rule |
| **Data dependency** | None. A labelled dev set of ~200 synthetic + adversarial submissions is enough to start |
| **Integration point** | Synchronous fast path, before the complaint ID is issued. `flag` routes to the manager's triage view; `reject` returns an actionable message to the citizen |

Master plan alignment: "don't force ML where rules are sufficient." Rules are sufficient here, possibly
permanently.

### 7.2 A2 — Classification & Routing · **BUILDABLE** baseline / **BLOCKED** model

| | |
|---|---|
| **Responsibility** | Infer category and responsible department from complaint text |
| **Input** | description (multilingual: Marathi / Hindi / English / romanised mix), citizen-selected category, ward |
| **Output** | `{ categoryId, confidence, departmentId, agreesWithCitizen, abstained }` |
| **Method** | Staged. (1) Keyword/rule map — extends the existing `deptForType`. (2) TF-IDF + linear SVM or logistic regression on labelled text — the correct baseline for a few thousand rows, and it is explainable by feature weights. (3) Multilingual transformer (XLM-R / IndicBERT) **only if** the labelled set is large enough to beat (2) on a held-out split. Abstain below a calibrated confidence threshold |
| **Fallback** | The citizen's selected category, which stays **authoritative** in Phase 1–2 |
| **Evaluation** | Macro-F1 (categories are imbalanced), per-class recall, routing accuracy = fraction reaching the correct department, and abstention rate at a fixed precision target. Compared against the "always trust the dropdown" baseline — if it cannot beat that, it does not ship |
| **Data dependency** | **BLOCKED** on the real category taxonomy and on labelled complaint text. Bootstrappable now with synthetic text and public grievance corpora, but the taxonomy must come from BWCMC — this agent must never invent a department |
| **Integration point** | Async enrichment. Disagreement with the citizen's choice surfaces as a **triage flag for the manager**, never an automatic reroute |

Master plan §2.2 is explicit: the fixed dropdown stays primary in Phase 1–2; NLP earns its place on
severity and analytics first. This contract implements that ordering rather than overriding it.

### 7.3 A3 — Severity (text + computer vision) · **BUILT** text / **BUILDABLE** CV research

| | |
|---|---|
| **Responsibility** | Assess how serious a complaint is, with a defensible reason |
| **Input** | description, categoryId, photoRef |
| **Output** | `{ severity: 1–5, confidence, reasoning, signals: [{ source: "text" \| "cv" \| "baseline", detail, contribution }] }` |
| **Method** | Composite, not one model. **Baseline:** per-category severity from configuration. **Text:** the existing keyword escalators, plus Gemini's assessment where available. **CV:** an explicit detection → severity mapping, not a black box (below) |
| **Fallback** | CV unavailable → text + baseline. Gemini unavailable → keyword fallback. Everything unavailable → category baseline. Already built and proven |
| **Evaluation** | CV detector: mAP@0.5 on annotated images. Severity as a whole: agreement with **officer-assigned** severity — quadratic-weighted Cohen's κ and MAE, on a set officers labelled independently. Never "accuracy against its own output" |
| **Data dependency** | Public road-damage/garbage datasets to start (**BUILDABLE** now as research); real municipal photos for domain adaptation and for the officer-labelled agreement set (**BLOCKED**) |
| **Integration point** | Async enrichment; officer-visible only (never shown to the citizen — the M3 rule) |

**On "YOLOv8 = severity" — it does not.** A detector outputs boxes and classes; severity is a separate,
documented mapping. What gets detected and how it converts:

| Detected | Measured | Contribution to severity |
|---|---|---|
| pothole | count + area as a fraction of visible road width | larger/multiple/lane-spanning → higher |
| standing water / leak | contiguous wet region area, proximity to carriageway | larger + on carriageway → higher |
| garbage accumulation | pile area, presence of organic/medical waste class | larger + hazardous class → higher |
| exposed wiring / open drain | presence at all | immediate high — a safety category, not a scale |

The mapping is configuration, reviewable and adjustable by an engineer who does not read Python. That is
the explainability requirement, applied to CV.

### 7.4 A4 — Duplicate Detection · **BUILT** Layer 1 / **BUILDABLE** Layer 2 research

| | |
|---|---|
| **Responsibility** | Identify whether a new complaint is an existing issue |
| **Input** | categoryId, street / lat-lng, time window, description (+ embedding), photo (Phase 3) |
| **Output** | `{ candidates: [{ complaintId, score, reasons[] }], clusterId?, method }` |
| **Method** | **Layer 1 (built, stays):** same category + same street within 168 h, shown to the citizen pre-submit. **Layer 2 (research):** multilingual sentence embeddings (LaBSE / multilingual-MiniLM) + geographic distance + time decay into a scored candidate list; DBSCAN over (embedding, geo, time) for officer-side clustering. Vector index only when candidate volume needs it — **pgvector**, since Supabase ships it and Qdrant/FAISS would add infrastructure for no gain at pilot scale |
| **Fallback** | Layer 1, which needs no model and no network |
| **Evaluation** | Recall@k for known duplicate pairs, precision at the deployed threshold, and the false-merge rate on the officer tool. A false merge hides a real complaint — weight it heavily |
| **Data dependency** | **BLOCKED** on labelled duplicate pairs and on GPS. Today's records have street names only, so the master plan's 50–100 m radius is **not currently computable** — see decision **D1** |
| **Integration point** | Layer 1 stays the citizen-facing pre-submit gate. Layer 2 is an **officer merge/flag tool**, never a citizen-facing block |

This is master plan §2.1 implemented as written: deterministic gate for citizens, research pipeline for
officers, built separately and evaluated before it is trusted.

### 7.5 A5 — SLA Risk · **BUILDABLE** pipeline / **BLOCKED** trained model

> The deterministic countdown in `lib/sla.js` is **not** this agent and is not replaced by it.
> `deadline = createdAt + slaHours` remains operational truth. A5 adds a *prediction on top*.

| | |
|---|---|
| **Responsibility** | Estimate the probability a complaint will miss its SLA, early enough to act |
| **Input** | categoryId, departmentId, severity, elapsed fraction of the SLA window, current status, time in current status, department open load, assigned worker's load, day-of-week / hour of submission, historical median resolution for category × department, reopenCount |
| **Output** | `{ pBreach: 0–1, riskBand: low \| medium \| high, topFeatures: [{ name, direction, magnitude }], horizon }` |
| **Method** | Gradient-boosted trees (XGBoost / LightGBM) — tabular, fast, and feature-attributable. Master plan §1 is explicit that this is right-sized and should **not** be "upgraded to deep learning for sophistication" |
| **Fallback** | Transparent heuristic: elapsed fraction of the window × the department's historical breach rate for that category, banded. Fully explainable, no model needed, ships first |
| **Evaluation** | ROC-AUC (plan-aligned) **plus PR-AUC and calibration** — breaches are the minority class, so ROC-AUC alone flatters a useless model, and an uncalibrated 0.9 that means 0.4 will destroy officer trust. Reliability curve + Brier score. Evaluated on a **time-based** split (train on earlier complaints, test on later), never a random split, because a random split leaks the future |
| **Data dependency** | **BLOCKED** on historical resolution times. The feature pipeline, the heuristic fallback, and the training/evaluation harness are **BUILDABLE now** against clearly-labelled synthetic ticket history — with the rule that **no performance number from synthetic data is ever quoted as a result** |
| **Integration point** | Re-runs on status change and on a schedule. Feeds the manager queue ordering as an *advisory* second sort key; the deterministic countdown stays the primary sort |

Label definition, fixed here because it determines everything: **the label is "breached the first SLA
segment"**, and a complaint whose resolution was later reopened is **not** counted as a clean resolution
(master plan §2.3).

### 7.6 A6 — Accountability · **BUILDABLE** on synthetic event history

| | |
|---|---|
| **Responsibility** | Surface operational patterns that indicate a process problem, not a dashboard |
| **Input** | `ComplaintEvent` history, `Assignment`, `ResolutionEvidence`, reopen counts, SLA segments |
| **Output** | Ranked `AccountabilityFinding` rows: `{ kind, scope, severity, evidence: [complaintIds/eventIds], metric, period }` |
| **Method** | Statistics over the event log, no LLM. Reopen rate by department / worker / category with confidence intervals (a worker with 2 of 3 reopened is not worse than one with 40 of 100 — use a shrunk estimate). Time-in-status outliers via robust z-score on log durations. Recurring-location detection: same street/asset + category recurring within N days. First-response vs. resolution latency split. Breach clustering by department × category × period |
| **Fallback** | Not applicable — deterministic. Insufficient sample size returns *no finding* rather than a noisy one |
| **Evaluation** | Human judgement: precision of surfaced findings rated by an officer ("is this real and actionable?"), plus stability — a finding that appears and vanishes week to week is noise. Small-sample suppression rate |
| **Data dependency** | Needs the `ComplaintEvent` log to exist and enough volume for significance. Metric definitions and the engine are **BUILDABLE now** on synthetic event logs; real findings are **BLOCKED** on pilot volume |
| **Integration point** | Periodic job. Manager sees own-department findings; admin sees all |

Guardrail: this agent must produce **findings with evidence links**, not charts. If an output cannot name
the complaints that justify it, it does not ship.

### 7.7 A7 — Policy Insight · **BLOCKED** on volume

| | |
|---|---|
| **Responsibility** | Turn aggregated complaint activity into municipal-level insight |
| **Input** | Aggregated complaints + events + geography + **exposure denominators** (population, households, road length per ward) |
| **Output** | `PolicyInsight` rows: `{ kind, geoScope, period, indicator, value, confidence, caveats[], evidence[] }` |
| **Method** | Spatial and temporal statistics. Hotspots via kernel density **normalised by exposure**, with Getis-Ord Gi\* or Moran's I to establish that a cluster is statistically real rather than a population artefact. Recurring-problem detection over categories × location. Seasonality/trend decomposition per department |
| **Fallback** | Report raw normalised counts with the caveat attached, rather than a hotspot claim |
| **Evaluation** | Temporal validity — do hotspots identified on one period persist in the next? Plus agreement with officer-known problem areas as a sanity check. An unstable hotspot map is a wrong hotspot map |
| **Data dependency** | **BLOCKED** twice over: needs real complaint volume, and needs ward demographic/exposure data (census + BWCMC) for the normalisation |
| **Integration point** | Periodic job, admin-facing. Every insight carries its caveats field into the UI |

**The bias correction is mandatory, not optional.** Master plan §2.4 documents the NYC 311 finding that
complaint volume tracks who is able and willing to complain, not where problems are. Two mechanisms
answer it: normalise by exposure, and include `sourceChannel = "officer_initiated"` entries so
field-observed problems enter the data even where nobody complained. A hotspot map built on raw citizen
volume alone would be a defensible-looking wrong answer, which is worse than no map.

---

## 8. Data strategy while municipal data is pending

**Rule one: synthetic data is never presented as municipal data.** Every synthetic record carries a flag
(`demo: true` already exists and is exactly the right precedent), every synthetic dataset lives under a
clearly named path, and no metric computed on synthetic data is quoted as a result in the report, the
pitch, or the documentation.

**Rule two: one synthetic marker, on every persisted entity.** Today's `demo: true` on complaints
generalises to a required `isSynthetic` boolean on **every** persisted row — `Ward`, `Department`,
`Category`, `SlaPolicy`, `User`, `Complaint`, `Assignment`, `ComplaintEvent`, `ResolutionEvidence`,
`AgentResult`, and `CitizenContact`, configuration included — so a demo row and a real pilot row can
never be confused once both live in the same store. Every query, export, analytics job, and model
evaluation must be able to filter it explicitly; a number computed without excluding `isSynthetic`
rows is not a result. Migrated prototype records are `isSynthetic: true`; real imported rows are
`isSynthetic: false`.

| Need | Interim source | Marker |
|---|---|---|
| Intake dev set (valid/junk submissions) | hand-written + adversarial synthetic | BUILDABLE |
| Complaint text for classification | synthetic + public grievance corpora (NYC 311 text, open Indian grievance sets) | BUILDABLE |
| Road/garbage images | public datasets (road-damage, waste-detection) | BUILDABLE |
| Historical ticket history for A5 | clearly-labelled synthetic generator with configurable breach rate | BUILDABLE |
| Event logs for A6 | replay of synthetic complaint histories | BUILDABLE |
| Category taxonomy, departments, SLA hours | **placeholder `seed.js` values** | BLOCKED |
| Officer/worker hierarchy | none | BLOCKED |
| Ward boundaries / GIS | none | BLOCKED |
| Duplicate ground truth | none | BLOCKED |
| Exposure denominators for A7 | census (partial) | BLOCKED |
| Asset register | none | BLOCKED |

**When municipal data arrives, in this order:** inspect it → document its actual structure (not the
structure we hoped for) → map it to the schema in §5 → clean and redact → integrate behind the same
repository interface → *then* re-evaluate every agent against it. Expect the taxonomy to differ from
`seed.js`; that is the whole reason categories are configuration.

---

## 9. Development sequence

Every agent follows the same twelve steps (define problem → I/O → data → deterministic baseline →
evaluate → improve → re-evaluate → package → integrate → end-to-end test → document → commit). For ML
agents, **evaluation is part of the implementation, not an afterthought**.

Proposed order, chosen so that each step unblocks the next and nothing waits on municipal data
unnecessarily:

| Step | Work | Why this order | Blocked? |
|---|---|---|---|
| **M5** | This document. Contracts, entities, permissions, migration plan | Everything else references it | no |
| **M6** | Repository interface: move `complaints.js` / `contacts.js` behind a data-access layer with identical signatures | Makes the storage swap a one-file change instead of a rewrite. Zero behaviour change | no |
| **M7** | `ComplaintEvent` append-only log + `AgentResult` table (still localStorage) | A6/A7 have nothing to read without it; `AgentResult` is needed before any second model | no |
| **M8** | Role model + `Assignment` + `ResolutionEvidence` + worker/manager surfaces (still no real auth) | Completes the human lifecycle middle, which is the biggest current gap | no |
| **M9** | A1 intake agent (deterministic, full contract + dev set + evaluation) | First agent through the whole 12-step process; proves the contract | no |
| **M10** | Supabase: schema, RLS, Auth, Storage migration | Needs M6–M8 shapes settled first | no |
| **M11** | A5 heuristic + feature pipeline + training harness on synthetic history | Highest officer value; harness must exist before real data arrives | model: yes |
| **M12** | A4 Layer 2 research (embeddings, offline evaluation) | Independent of the app; runs as research | tuning: yes |
| **M13** | A3 CV research on public datasets | Longest lead time, so start early, integrate late | adaptation: yes |
| **M14** | A2 model, A6 findings engine, A7 insights | Depend on taxonomy and volume | yes |

M6–M8 are deliberately **unglamorous plumbing**. They are also the reason the later agents can be built
at all: without an event log and versioned agent results, A5/A6/A7 have no inputs and no way to be
evaluated.

---

## 10. localStorage → Supabase migration path

Staged so that no stage requires a rewrite of the stage before it.

**Stage A — Repository interface (M6, no Supabase involved).** Introduce `lib/repo/*` exposing exactly
today's function signatures (`listComplaints`, `getComplaint`, `createComplaint`, `advanceStatus`,
`findDuplicates`, `saveContact`, `getContact`). The localStorage implementation moves behind it
unchanged. Callers do not change. This is the whole migration, de-risked into one step.

**Stage B — Schema as code.** SQL migrations in `supabase/migrations/` for the §5 entities, committed but
**not applied**. Reviewable before anything is provisioned.

**Stage C — Provision + apply.** Create the project, apply migrations, load configuration (wards,
departments, categories, SLA policies) from what is currently `seed.js`. `demo: true` records are **not**
migrated — the demo seed is scaffolding, not history.

**Stage D — RLS before Auth.** Write and test row-level security policies against the §3.2 matrix using
service-role test users, *before* real users exist. Notably: `citizen_contact` denies `SELECT` to every
operational role; the notification service is the only reader, via service role.

**Stage E — Supabase Auth.** Replace the placeholder staff form with real sign-in; map users to roles and
departments. The landing page's role selector becomes a real authentication boundary. Only at this point
does the app have authentication — and the placeholder is labelled as such in code until then.

**Stage F — Storage for photos.** Replace 1024 px/q0.7 data URLs (a localStorage size workaround) with
Supabase Storage objects + signed URLs. `photoRef` already anticipates this indirection.

**Stage G — Read-path swap + cutover.** Point the repository implementation at Supabase, keep the
localStorage implementation available behind a flag for offline demos, then remove it once the pilot is
stable.

Data migration itself is a one-time export of the localStorage JSON into inserts. Because complaint IDs
are already ward-scoped and sequential, they survive migration unchanged.

---

## 11. Explicitly out of scope for M5

M5 delivers this document and nothing else. Out of scope:

- Provisioning Supabase, applying any schema, or writing any RLS policy
- Real authentication, password handling, or session management
- Building **any** of the seven agents (including A1, which is buildable but is M9)
- Python services, model training, or CV work
- Manager / worker / admin UI surfaces
- Notifications, escalation, appeals
- Any behavioural change to the M0–M4 prototype
- New dependencies of any kind
- Inventing municipal data, or presenting synthetic data as municipal
- Replacing the deterministic duplicate suggestion or the deterministic SLA countdown
- New dashboards or charts

---

## 12. Alignment with Master Plan v2

| Master plan | This architecture |
|---|---|
| §1 Deterministic-first | §2.2: agents advise, deterministic core decides; every agent has a deterministic fallback and ships its baseline first |
| §1 Asset-centric complaints — "your strongest differentiator, keep it as the headline USP" | `Asset` entity + `complaint.assetId` in §5, marked BLOCKED on the asset register. Retained as a target rather than dropped |
| §1 SLA as tabular ML, not deep learning | §7.5: XGBoost/LightGBM, with the plan's warning against "upgrading for sophistication" recorded in the contract |
| §1 Reopened tickets as a first-class metric | §4.2 makes `Reopened` a state, not a flag; §7.5 excludes reopened resolutions from clean-resolution labels; §7.6 makes reopen rate a headline metric |
| §2.1 Two-layer duplicate detection | §7.4: Layer 1 (built) stays the citizen-facing pre-submit gate; Layer 2 is an officer merge tool, built separately and evaluated |
| §2.2 Hybrid intake taxonomy | §7.2: dropdown stays authoritative in Phase 1–2; the classifier is advisory with abstention and must beat the dropdown baseline to ship |
| §2.3 CPGRAMS appeals / satisfaction confirmation | §4.2 `Reopened` + `Closed`-after-confirmation; citizen contest path feeds A5 labels and A6 metrics |
| §2.4 Reporting-bias / equity risk | §5 `sourceChannel` incl. `officer_initiated`; §7.7 makes exposure normalisation mandatory with caveats surfaced in the UI |
| §2.5 Governance risk — contact details | §3.4: no operational role reads contact data, admin included; enforced by RLS + a notification service, not by UI hiding |
| §3 Phase table | §8/§9 BUILDABLE-vs-BLOCKED split mirrors the Phase 1/2/3 sequencing (embeddings and CV in Phase 3; SLA ML trained on pilot data) |
| §4 Phase 2 pilot scope | §9 M6–M10: one ward, three departments, real accounts, contact isolation |
| §5 Pitch answers | §7.4 and §3.4 are the implementations behind both prepared answers |

Where this document goes beyond the master plan, it is additive and flagged: the `AgentResult`
versioning discipline (§5.1), the intake/operational split (§4.1), PR-AUC and calibration alongside
ROC-AUC (§7.5), and the async-enrichment orchestration (§6.3).

---

## 13. Open decisions needing sign-off

These change the architecture and are **not** mine to decide.

| # | Decision | Recommendation |
|---|---|---|
| **D1** | ~~**GPS capture.**~~ **APPROVED and expanded → see §14, "D1 — Geospatial & Evidence Metadata."** Original framing: complaints store a street name only, so the master plan's 50–100 m duplicate radius and A7's spatial statistics are not currently computable | **Resolved.** Structured, provenance-carrying complaint location + a storage-neutral `Evidence` model, with photo EXIF as *supporting* metadata only. Architecture only — nothing implemented |
| **D2** | **Admin access to citizen contact.** §3.4 proposes *no* human role ever reads it | Confirm "no", with an audited escalation flow if BWCMC requires one |
| **D3** | **Track-by-ID.** `/track/:id` is an unauthenticated read — the ID is effectively a capability token. Fine for anonymous reporting, but it means anyone with an ID sees that complaint | Keep ID-as-token for anonymous; bind to the owner when a citizen is signed in |
| **D4** | **Vector store.** pgvector (ships with Supabase) vs. FAISS/Qdrant | pgvector — no new infrastructure at pilot scale |
| **D5** | **Async intake.** Move A3/A5 off the submit path so the citizen never waits on a model | Yes, from M7; keep the 4 s ceiling until then |
| **D6** | **Asset registry.** The master plan calls it the headline USP but it is fully blocked on BWCMC's asset data | Keep `assetId` in the schema now; build when data exists |
| **D7** | **Worker accounts in the first pilot.** It is unsettled whether field-worker logins are activated in pilot phase one or deferred — with workers deferred, `Assigned` means *department ownership*, not a named worker | Model `Worker` and `Assignment` now (§3.3, §5); gate whether the worker surface and login are activated on the pilot phase, so schema support never assumes activation |

---

## 14. D1 — Geospatial & Evidence Metadata

**Status:** approved decision, **architecture only**. Nothing in this section is implemented. No code,
no library, no browser API, no CV model has been added. §14.12 states exactly what exists today.

**Scope.** D1 was approved as: *"CivicPulse should support structured geospatial information for
complaints and resolution evidence, while treating photo EXIF geolocation as supporting metadata rather
than the authoritative location source."* It grew from "add lat/lng" into the shape that complaint
location, evidence, metadata, and future vision output must have so that later work does not require a
schema rewrite.

**This section does not touch D2–D6.** Their recommendations in §13 stand unchanged.

### 14.1 Three kinds of information, never conflated

The single most important distinction in D1. These are separate records with separate trust levels,
separate access rules, and separate lifecycles:

| # | Kind | What it is | Trust | Written by |
|---|---|---|---|---|
| 1 | **Original Evidence** | The bytes the citizen or worker actually uploaded | Ground truth for *what was submitted* | upload path only, immutable after write |
| 2 | **Extracted Metadata** | Facts read *out of* the file or device — EXIF, dimensions, capture time | Claims by the device, not verified facts | extraction step |
| 3 | **Derived Intelligence** | AI/ML/CV inferences *about* the content | Probabilistic, model- and version-dependent | vision/agent layer |

Collapsing any two of these is how systems end up unable to answer "did the model see that, or did the
camera say it?" A GPS coordinate in EXIF is category 2 — a claim the device made — not category 1, and
never category 3.

The same rule already governing agents (§2.2) applies here: **categories 2 and 3 never overwrite
category 1**, and neither silently overwrites the operational location a human or device provided.

### 14.2 Complaint location (A)

An **optional, structured, nullable** object on `Complaint`. Optional is deliberate: street-only records
from M0–M4 must stay valid, and a citizen who declines a location permission must still be able to report.

```
Complaint.location?  =  {
  latitude:        number,
  longitude:       number,
  accuracyMeters:  number | null,   // radius of confidence, when the source reports one
  source:          LocationSource,
  capturedAt:      timestamp | null // when the position was fixed, not when it was saved
}
```

`LocationSource` — a closed set, so an unknown provenance can never be mistaken for a known one:

| Value | Meaning |
|---|---|
| `device_gps` | Positioning API reading at capture time; normally carries `accuracyMeters` |
| `user_selected` | The person placed a pin on a map deliberately |
| `manually_entered` | Coordinates or an address typed in and resolved |
| `photo_exif` | Read out of an uploaded file's metadata — **supporting only** (§14.3) |
| `unknown` | No provenance recorded; includes records migrated from the prototype |

**Authority rule.** When `Complaint.location` is present it is the **authoritative operational
location** — the value used for dispatch, mapping, spatial analysis, and duplicate proximity. Photo EXIF
GPS does **not** automatically become it (§14.3).

**`street` is not a location.** It is a categorical reference to a configured street, and it stays.
`streetCoords.js` maps it to a hand-placed centroid **for display only** — that centroid must never be
written into `location`, because doing so would launder a demo constant into apparent GPS data. A
complaint with no `location` renders on the street centroid *labelled as approximate*, exactly as the
officer map already does.

### 14.3 Location provenance and trust ordering (D)

**Not all location sources are equally reliable, and the system must be able to tell them apart.**
Provenance is recorded on every location object, and consumers are expected to read it.

| Source | Reliability | Why |
|---|---|---|
| `device_gps` | highest — *when* `accuracyMeters` is small | A live fix at the scene. A 2000 m accuracy reading is a wifi/cell estimate, not a GPS fix, and must be treated as such |
| `user_selected` | high intent, unbounded precision | The person meant that spot, but "that spot" may be a rough guess |
| `manually_entered` | medium | Typo- and geocoder-dependent |
| `photo_exif` | **supporting only** | See below |
| `unknown` | none | Must never be silently upgraded |

**Why EXIF GPS is supporting evidence and not authoritative:**

- The photo may have been taken elsewhere, or on a different day, and uploaded later.
- Forwarded images (messaging apps, re-saves) commonly have metadata stripped, altered, or re-encoded.
- The device clock and the device position can both be wrong, and EXIF has no integrity guarantee.
- It is trivially editable — nothing in an EXIF field is attested.

**Corroboration, not correction.** When both a `Complaint.location` and an EXIF-derived location exist,
the system **compares** them and records the outcome:

```
distance(complaint.location, evidence.metadata.location)
   ≤ threshold  → corroborated   (raises confidence in the location)
   >  threshold → divergent      (a review flag, visible to the manager)
```

A divergence is **never** auto-resolved by overwriting either value. If no `Complaint.location` exists,
EXIF may be *offered* as a suggestion for a human to accept — which then stores it as
`source: user_selected`, honestly recording that a person confirmed it.

### 14.4 Evidence object (B)

Evidence is modelled **independently of the complaint**, as a collection, and
**storage-provider-neutral** — no Supabase, S3, or filesystem concept appears in the model. `storageRef`
is an opaque pointer that a repository implementation resolves.

```
Evidence  =  {
  evidenceId:      id,
  complaintId:     id,
  kind:            "citizen_report" | "resolution_before" | "resolution_after"
                   | "officer_observation",
  mediaType:       "image" | "video",

  // storage — opaque, provider-neutral pointers
  storageRef:      ref,          // canonical stored object
  originalRef:     ref | null,   // preserved original bytes, access-controlled (§14.6)
  displayRef:      ref | null,   // sanitized, resized copy safe to serve (§14.6)

  mimeType:        string,
  byteSize:        number,
  width:           number | null,
  height:          number | null,
  checksum:        string,       // e.g. sha-256 over the original bytes

  uploadedAt:      timestamp,    // server-side, trusted
  capturedAt:      timestamp | null,  // from metadata — a device claim, untrusted

  location:        Location | null,   // same shape as §14.2; typically source=photo_exif
  metadataStatus:  MetadataStatus,
  metadataSummary: object | null,     // the stored allow-list subset only (§14.5)

  createdByKind:   "citizen" | "worker" | "manager" | "system",
  createdByUserId: id | null      // null for anonymous citizen submissions
}
```

`MetadataStatus` distinguishes the cases that "no metadata" would otherwise blur together:

| Value | Meaning |
|---|---|
| `not_attempted` | Extraction has not run |
| `extracted` | Ran, fields stored per the allow-list |
| `unavailable` | Ran, the file genuinely carried none |
| `stripped_by_source` | Metadata was removed before we received it (messaging-app re-encode, or our own resize — see §14.13) |
| `failed` | Extraction errored; the evidence remains valid and usable |

Two deliberate properties: `createdByUserId` is nullable so anonymous reporting survives intact, and
`checksum` gives evidence integrity without depending on any storage provider's features.

### 14.5 EXIF and photo metadata (C)

Governing principle:

> **Extract broadly, store selectively.**

Extraction may read whatever a file offers. Persistence is an **allow-list**, because metadata is one of
the easiest ways to leak information nobody asked to share.

**Candidate fields available in practice:** GPS latitude/longitude/altitude, capture timestamp, camera
make and model, lens information, orientation, image dimensions, exposure settings, software/editing
history, embedded thumbnails, and vendor `MakerNote` blobs.

**Stored by default** — each because a defined consumer needs it:

| Field | Why it is kept |
|---|---|
| Image dimensions | Display sizing; a CV input precondition |
| Orientation | Without it, images display rotated |
| Capture timestamp | Corroborates "how long has this been a problem"; stored as an untrusted claim |
| GPS lat/lng (+ altitude) | Supporting location evidence only (§14.3) |

**Not stored by default** — each because it identifies a device or a person more than it describes a
civic problem:

| Field | Risk |
|---|---|
| Camera make / model | Device fingerprint |
| Device or lens serial numbers | Strong, near-unique device identifier |
| Owner / artist / copyright fields | Often contains a real name |
| Software / editing history | Reveals the person's tooling and workflow |
| Embedded thumbnail | **May retain a pre-edit version of the image** — defeats redaction |
| Vendor `MakerNote` | Opaque, large, and frequently contains serials |

**The anonymity consequence, stated plainly.** CivicPulse allows anonymous reporting, and `contacts.js`
stores nothing when no field is filled. Device-identifying EXIF would undo that by **linkage**: several
"anonymous" complaints carrying the same camera serial are trivially the same reporter. Any field that
fingerprints a device is therefore a de-anonymisation vector and is excluded by default, not stored and
hidden. If such a field is ever needed (e.g. detecting bulk spam from one device), it is stored as a
**salted hash**, never the raw value, and never surfaced in any UI.

Precision is also a privacy control: ~4 decimal places is roughly 11 m and ~3 is roughly 111 m. Full
precision may be retained operationally while anything citizen- or publicly-facing is reduced. The exact
public precision is a municipal policy question, not an engineering one (§14.12, blocked).

### 14.6 Original vs. processed evidence (E)

A future pipeline. **Not implemented.**

```
        Original upload (bytes as received)
                    │
                    ▼
        Secure preservation            ── immutable, checksummed, access-controlled;
                    │                     never served publicly
                    ▼
        Metadata extraction            ── reads broadly, stores per §14.5 allow-list
                    │
                    ▼
        Safe / processed display copy  ── resized, metadata stripped; this is what UIs serve
                    │
                    ▼
        Future AI / CV analysis        ── runs on the PRESERVED ORIGINAL, not the display copy
```

Two properties matter:

1. **The original is preserved where policy permits**, because it is the evidentiary record — the thing
   that answers "what did the citizen actually submit?" It is access-controlled and never the object a
   browser fetches.
2. **CV runs on the original, not the display copy.** A downscaled, re-compressed copy has already
   destroyed the fine detail a detector needs (the current prototype's 1024 px at quality 0.7 is exactly
   such a lossy copy). Analysing the display copy would silently cap model performance.

Retention duration and deletion rules are **municipal policy**, deliberately not invented here.

### 14.7 Future resolution evidence (F)

The **same `Evidence` model** carries worker-submitted proof of work — no second schema. Only `kind`,
`createdByKind`, and access rules differ:

| Use | `kind` | Notes |
|---|---|---|
| Citizen's report photo | `citizen_report` | Exists today as a scalar `complaint.photo` |
| Before-work photo | `resolution_before` | Establishes the pre-work condition |
| After-work photo | `resolution_after` | The proof-of-work artefact |
| Optional short video | either, `mediaType: "video"` | Same metadata and provenance rules |
| Officer-observed issue | `officer_observation` | Supports the §2.4 officer-initiated entry path |

Capture timestamp, optional location with provenance, and the worker actor reference are what make this
useful later: verification (§4.2 `Work Completed → Verified`), accountability analysis (A6), and a
citizen-facing "here is what was done" view. Worker UI and the resolution workflow are **not built and
not part of D1** — this only reserves the shape so they need no schema change.

### 14.8 Future vision observations (G) — model-agnostic by construction

A reserved place for CV-derived output. **No model is chosen, trained, deployed, or depended upon.**

```
VisionObservation  =  {
  observationId:   id,
  evidenceId:      id,             // always attached to evidence, never to a complaint directly
  task:            string,         // logical task contract, e.g. "road_damage_detect"
  modelName:       string,         // implementation — swappable
  modelVersion:    string,
  observationType: "detection" | "classification" | "segmentation" | "quality",
  detections: [ { label, confidence, bbox?, maskRef? } ],
  confidence:      number | null,  // observation-level, where meaningful
  latencyMs:       number,
  createdAt:       timestamp
}
```

**How model-agnosticism is achieved:** `task` is the contract the rest of the system codes against;
`modelName` + `modelVersion` are the interchangeable implementation. Nothing outside the vision adapter
knows what produced a detection.

**YOLO is explicitly not an architectural dependency.** It is one candidate family for detection tasks
such as potholes or streetlight faults, alongside DETR/RT-DETR-style detectors, classical CV for some
measurements, and hosted vision APIs. The choice is an evaluation outcome later (§7.3), not a
commitment now. Append-only and version-stamped, for the same reason `AgentResult` is (§5.1): so a
replacement model can be compared against its predecessor on identical evidence.

`VisionObservation` is **derived intelligence** (§14.1 category 3). It never writes `Complaint`,
`Evidence`, or any location field. It feeds A3 severity as one signal among several, exactly as §7.3
specifies.

### 14.9 Privacy principles for evidence and metadata (I)

Extending §3.4 to evidence. These are engineering principles; no legal or compliance claim is made.

1. **Do not expose device or EXIF metadata to other users.** The display copy is metadata-stripped
   (§14.6). Metadata that is retained is an internal record, not UI content.
2. **Do not expose exact citizen location publicly by default.** A photograph taken at or near a
   reporter's home can locate them. Reduce precision on anything citizen- or publicly-facing.
3. **Do not assume photo metadata is safe to display.** Treat it as untrusted *and* sensitive at once.
4. **Minimise what is retained** (§14.5 allow-list). Un-stored metadata cannot leak.
5. **Preserve provenance.** Minimisation must not erase *where a value came from* — that is what makes
   trust decisions possible (§14.3).
6. **Access-control original evidence.** Originals are never publicly addressable; access follows the
   §3.2 matrix and is logged as a `ComplaintEvent`.
7. **Keep identity separate from evidence.** Evidence is operational data. It carries no name, phone, or
   email, and `createdByUserId` is null for anonymous submissions. The §3.4 separation is not weakened by
   adding evidence.
8. **Beware fingerprinting.** Per §14.5, device-identifying metadata can de-anonymise an anonymous
   complaint through linkage; excluded by default.

### 14.10 Conceptual data model

```
Complaint
 ├── street                      categorical reference (NOT a coordinate)
 ├── location?                   ◄── AUTHORITATIVE operational location when present
 │     { latitude, longitude, accuracyMeters, source, capturedAt }
 │       source ∈ device_gps | user_selected | manually_entered | photo_exif | unknown
 │
 └── Evidence[]                  (independent entity, a collection)
       ├── Original File         preserved, checksummed, access-controlled
       ├── Display Copy          sanitized + resized — what UIs serve
       ├── Metadata              extracted broadly, stored selectively
       │     └── location?       ◄── SUPPORTING evidence only (source = photo_exif)
       └── VisionObservation[]   FUTURE — derived intelligence, model-agnostic
```

The two location kinds stay distinguishable at every point, and are compared rather than merged:

```
   Complaint.location            (source = device_gps)      → authoritative: dispatch, mapping, analysis
   Evidence.location             (source = photo_exif)      → supporting: corroborate or flag

   compare(authoritative, supporting)
        within threshold  → corroborated
        beyond threshold  → divergent → manager review flag   (never auto-overwrite)
```

### 14.11 What D1 enables — all **future** capabilities

None of these exist. D1 exists so that each becomes an implementation task rather than a schema
migration:

| Future capability | What it needs from D1 |
|---|---|
| Complaint mapping on real coordinates | `Complaint.location` instead of a hand-placed street centroid |
| Ward-level spatial analysis (A7) | Coordinates + provenance, so low-trust points can be excluded |
| Geographic duplicate detection (A4 Layer 2) | Real distances — the master plan's 50–100 m radius becomes computable |
| Hotspot detection (A7) | Point data, plus `sourceChannel` to offset reporting bias (§7.7) |
| Asset association | A coordinate to match against an asset register (blocked — D6) |
| Worker task location | An authoritative location a worker can navigate to |
| Resolution verification | `resolution_before` / `resolution_after` evidence with capture time and location |
| Future CV analysis | Preserved originals + `VisionObservation` |
| Municipal asset registry integration | Coordinates + asset reference (blocked on BWCMC data) |

### 14.12 D1 status — BUILT / BUILDABLE / BLOCKED / FUTURE

**BUILT NOW** (verified in the M0–M4 source — this is all that exists):

- One optional photo per complaint, via `PhotoInput` (`accept="image/*"`, `capture="environment"`).
- `image.js#fileToResizedDataUrl` — canvas downscale to max 1024 px, re-encoded JPEG at quality 0.7,
  returned as a data URL.
- That data URL stored **inline** as the scalar `complaint.photo`. No evidence entity, no original, no
  metadata, no checksum, no collection.
- Location is a **street name only**. `streetCoords.js` supplies a hand-placed centroid per seed street
  for map display, with its own header stating the values are not surveyed.
- Persistence is `localStorage` through `storage.js`.

**BUILDABLE WITHOUT MUNICIPAL DATA** (designed here, not built):

- The structured `Complaint.location` field, nullable and additive.
- The `Evidence` abstraction and its repository interface.
- EXIF extraction with allow-list storage — but see §14.13, it must read the **original `File`**.
- Optional browser geolocation capture, permission-gated, recording `accuracyMeters`.
- Map-pin selection and manual coordinate entry.
- Sanitized display-copy generation and checksums.
- Provenance recording, trust ordering, and the EXIF-divergence review flag.

**BLOCKED — data or policy dependent:**

- Municipal asset association (needs BWCMC's asset register — D6).
- Authoritative ward-boundary containment (needs real GIS polygons; the current single ward is a
  configuration placeholder).
- Municipal GIS integration.
- Evidence retention and deletion policy — a municipal decision, not invented here.
- Public coordinate-precision policy (§14.5).

**FUTURE — architecturally reserved, deliberately not built:**

- `VisionObservation` and any CV inference; no model selected.
- Resolution-evidence workflow and worker UI.
- Geospatial intelligence: proximity duplicates, hotspots, spatial statistics.

### 14.13 Findings in the current code that D1 exposes

Reported, **not fixed** — each is a future implementation item requiring its own approval.

1. **The current pipeline destroys EXIF before anything is stored.** `fileToResizedDataUrl` re-encodes
   through a canvas, and canvas re-encoding drops all EXIF, GPS included. So EXIF extraction cannot be
   bolted on later at the storage layer: it must read the **original `File`** in `PhotoInput`'s change
   handler, *before* the resize. `PhotoInput` currently discards that `File` immediately after
   conversion, which also means **"original file preservation" (§14.4, §14.6) is impossible today**
   without touching that component. Any migrated prototype record should be recorded as
   `metadataStatus: "stripped_by_source"` rather than `unavailable` — the metadata existed, our own
   pipeline removed it.

2. **A submit can fail silently.** `complaints.js#saveAll` discards the boolean `writeStore` returns, and
   `createComplaint` does not check it. With ~1 MB data-URL photos against a browser quota of roughly
   5 MB, a write can fail while `createComplaint` still returns a complaint object and navigation
   proceeds to `/confirmation/:id` — where `getComplaint` finds nothing and the citizen is bounced back
   to the form with no explanation. Low demo risk, real pilot risk; it also argues for moving photos out
   of the record before evidence collections multiply the payload.

3. **`complaint.photo` is scalar, `Evidence` is a collection.** Migration is straightforward and worth
   fixing in the schema rather than in the UI: wrap the existing value as a single
   `kind: "citizen_report"` evidence record with `metadataStatus: "stripped_by_source"`.

4. **The street centroid is a demo constant that could be mistaken for real data.** §14.2 forbids writing
   it into `location`; that prohibition needs to survive into the implementation, or a hand-placed
   coordinate will end up in a spatial analysis.

5. **Orientation must be handled explicitly** once originals are kept. It is the one EXIF field whose
   loss is immediately visible — sideways photos — and it interacts with the resize step.

---

## 15. OPEN QUESTIONS — municipal facts we will not invent (M8.5)

> **Added 2026-09-15 (M8.5).** These are questions only the municipality can answer. Each one is
> implemented behind an isolated, replaceable seam so the answer, when it arrives, is a file edit —
> not a refactor. Nothing below is resolved by inference, hierarchy, or "reasonable defaults".

| # | Question | Current placeholder | Seam / owner | Status |
|---|---|---|---|---|
| 1 | **Who is authorized to assign work to Ward 6 Sanitation staff?** Is assignment authority department-scoped, ward-scoped, or cross-department? | INTERIM: any `roleClass: "manager"` person may assign any Ward 6 complaint; assignee must be a worker in the complaint's department. | `client/src/lib/assignmentPolicy.js` (single file; header documents the interim status; every decision is recorded as `kind: "assignment-authority"` DecisionResult for retrospective audit) | Asked of the councillor's office; **awaiting reply** |
| 2 | **Complaint-type → specific worker routing** (e.g. Garbage → Mukadam A, Drainage → Mukadam B) | Deliberately **absent**. No routing of any kind exists; visibility and eligibility are department-level only. | Nothing to edit yet — if routing data arrives it becomes a new input to `assignmentPolicy.eligibleAssignees` | No data; will not infer |
| 3 | **What does municipal verification of resolution evidence mean?** Who verifies, when, and what counts as valid evidence? | Evidence is **submission-only**: recorded, event-logged, and visible. No verified/verifiedBy/verificationStatus fields, no approve/reject flow. | `client/src/lib/resolutionEvidence.js` (header forbids adding verification fields silently) | OPEN |
| 4 | **Classification of plain "Supervisor" titles** (W6-GAR-01, W6-WAT-01, W6-CON-01, W6-ELE-01) | `roleClass: null` (OPEN). They can be selected as staff but cannot be assigned work and cannot assign. | `client/src/data/seed.js` roleClass values; assignment denial message says "pending clarification" | OPEN pending municipal clarification |

*History note (Part E, M8.5):* Vikram Darade and Vitthal Dake each oversee two departments. They are
single persons with a `depts` array (`W6-WAT-05`: Water Supply + Construction; `W6-GAR-05`: Garden +
Electrical); their retired M8 personIds resolve via an alias map in `lib/roles.js`. This is source
data, not invented hierarchy.

---

*End of document. Preserved alongside — not in place of —*
[`CivicPulse-Master-Plan-v2.md`](./CivicPulse-Master-Plan-v2.md).
