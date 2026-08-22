# CivicPulse

**Multi-Agent Intelligent Grievance Redressal & Civic Accountability Platform**
— a Final Year Engineering Project prototype, built for a demonstration to
**Bhiwandi-Nizampur City Municipal Corporation (BWCMC)**.

It answers one question: *if BWCMC gives us access to their complaint data, can this
system solve the problems in how citizen grievances are handled today?*

> ⚠️ **This is a demo prototype, not production software.** All data lives in the
> browser (`localStorage`) — there is **no database and no backend product store**.
> Clearing browser storage resets everything. Map locations are **representative per
> street, not surveyed GPS**. It is scoped to a single ward (**W14, Kaman-Anjur
> Cluster**) with a small fixed set of seed values for the demo.

---

## What it does

**Citizen side** (mobile-friendly)
- Report a civic issue — type, street, description, photo; contact details optional
  (anonymous reporting works).
- Automatic department routing from the complaint type.
- Duplicate suggestion before submit (same type + street within 7 days).
- Instant complaint ID + a live status timeline anyone can track.

**Officer side** (desktop console)
- A single queue ranked by SLA urgency (overdue first), with status filter and a
  map view.
- Deterministic SLA countdown per complaint type; overdue is computed, not guessed.
- One-step-forward status transitions with timestamped history that the citizen's
  tracker reflects automatically.
- **AI severity assessment** (1–5 + one-line reason) shown to officers only.

**AI layer**
- On submit, the app asks Google **Gemini** (through a local proxy) to assess
  **severity only** — it confirms, never changes, the citizen's chosen category.
- If the call fails, times out, or the key is missing, it silently falls back to a
  deterministic keyword rule with the **same output shape** — the citizen never sees
  an error. A hard ~4s client ceiling guarantees submit never hangs.

**Privacy by design**
- The operational complaint record contains **no name/phone/email**. Personal
  details are stored in a **separate** store keyed by complaint ID that officer/field
  code never imports. The separation is enforced by data shape, not convention.

---

## Architecture

```
client/   React 19 + Vite + Tailwind CSS v4, react-router, react-leaflet
            └─ localStorage only (seed data + submissions). No product DB.
proxy/    Express server on :3001 — the ONLY place the Gemini API key is used.
            └─ POST /classify → Gemini severity assessment (key stays server-side)
docs/     Master plan, this demo's click-by-click script (demo-script.md)
```

The API key **never reaches the browser** — the client calls the local proxy, and
the proxy calls Gemini with the key from `proxy/.env` (gitignored).

---

## Running it locally

Requires **Node 18+**.

### 1. Proxy (enables the real AI call)

```bash
cd proxy
npm install
# Create proxy/.env with your key (this file is gitignored, never commit it):
#   GEMINI_API_KEY=your_key_here
node server.js
```
Expect: `CivicPulse proxy running at http://localhost:3001`.
The app runs fine **without** the proxy too — it just uses the deterministic
fallback severity.

### 2. Client

```bash
cd client
npm install
npm run dev
```
Open the URL Vite prints (typically `http://localhost:5173`). On first load the app
seeds three clearly-marked demo complaints so the queue and duplicate check have
data to work with.

### Other commands (client)
```bash
npm run build     # production build
npm run preview   # serve the production build
npm run lint      # eslint
```

---

## Deployment

The proxy and client deploy separately. Copy each `.env.example` to `.env` for local
runs; set the same variables in the host dashboards for production. No secret or
deployed URL is hardcoded in the source — everything comes from env vars.

**Proxy → Render** (Web Service)
- Root directory: `proxy`
- Build command: `npm install`
- Start command: `node server.js`
- Environment variables:
  - `GEMINI_API_KEY` — your Google Gemini key
  - `ALLOWED_ORIGIN` — the deployed client URL (e.g. `https://your-app.vercel.app`); comma-separated if more than one

**Client → Vercel**
- Root directory: `client`
- Framework preset: Vite
- Environment variable:
  - `VITE_PROXY_BASE_URL` — the deployed proxy URL (e.g. `https://your-proxy.onrender.com`)

Deploy the proxy first, then set `VITE_PROXY_BASE_URL` to its URL before building the
client, and set `ALLOWED_ORIGIN` on the proxy to the client's URL.

---

## For the demo

See **[`docs/demo-script.md`](docs/demo-script.md)** for the exact click-by-click
walkthrough, the seeded data, and a resilience demo (pull the network, show it still
resolves).

---

## Scope & limitations (deliberate, for the prototype)

- Single ward, fixed seed values (streets, departments, complaint types, officers).
- No authentication — the officer console shows a display-only officer context.
- No notifications, escalation, analytics, or field-worker app.
- SLA is deterministic arithmetic, not prediction/ML.
- Data is local to the browser and non-persistent across a storage clear.
