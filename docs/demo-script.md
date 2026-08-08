# CivicPulse — Sunday Demo Script (BWCMC)

**Audience:** Bhiwandi-Nizampur City Municipal Corporation officials (non-technical).
**Question this demo answers:** *"If BWCMC gives us access to their data, can this
system solve the complaint-management problems they have today?"*

**Duration:** ~7 minutes. **Setting:** one laptop, projector. Runs entirely on this
machine — no BWCMC data, no cloud database. Everything you see is local.

> This is a **prototype**. Data lives in the browser (localStorage) and resets when
> cleared. Locations are representative, not surveyed GPS. The AI severity call is
> real (Google Gemini via a local proxy) but degrades silently to a deterministic
> rule when offline — you can demo that on purpose (see *Resilience*).

---

## 0. Before officials arrive (setup — do this once)

1. **Start the proxy** (enables the real AI call):
   ```bash
   cd proxy
   node server.js
   ```
   Wait for: `CivicPulse proxy running at http://localhost:3001`.
2. **Start the app** (a second terminal):
   ```bash
   cd client
   npm run dev
   ```
   Note the URL Vite prints (usually `http://localhost:5173`).
3. **Open a fresh browser window** (or Incognito) at that URL. A fresh window is
   important — on first load the app seeds **3 demo complaints** so the queue and
   the duplicate check have something to work with.
4. **Have one photo ready** on disk to upload (a photo is required to submit).
5. Confirm the browser tab reads **"CivicPulse — Bhiwandi-Nizampur City"** and the
   Report page shows. You're ready.

**To reset between rehearsals:** open DevTools console (F12) → run
`localStorage.clear()` → reload. Or just open a new Incognito window.

**What's seeded on a fresh load** (you don't type these — they're already there):

| ID          | Type               | Street              | Status      | SLA   | Age at load |
|-------------|--------------------|---------------------|-------------|-------|-------------|
| CP-W14-0001 | Pothole            | Kaman Bhiwandi Road | Assigned    | 72h   | 48h ago     |
| CP-W14-0002 | Garbage Collection | Golani Naka         | Submitted   | 12h   | 6h ago      |
| CP-W14-0003 | Water Leakage      | Anjur Phata         | In Progress | 24h   | 24h ago     |

On a fresh load **CP-W14-0003 is already overdue** (red) — useful for the SLA point.

---

## ACT 1 — The citizen side (the intake problem today)

### Beat 1 — Submit a real complaint (auto-routing + AI triage + privacy)

On the **Report a civic issue** page (`/`):

1. **Complaint type** → select **"Drainage Blockage — Water Supply"**.
   - *Say:* "The citizen picks a category; the system already knows which
     department owns it — no manual routing."
2. **Street / location** → select **"Shanti Nagar"**.
3. **Description** → type:
   > `Drainage blocked and sewage overflowing near the school gate, smells terrible.`
   - *Say:* "This wording matters — watch what the AI does with it in a moment."
4. **Photo** → upload your ready image.
5. **Contact details** → leave blank (or type just a first name to show the receipt
   greeting).
   - *Say:* "Reporting can be **anonymous**. If they do give a name or phone, it is
     stored **separately** and is **never** shown to field staff — I'll prove that
     on the officer screen."
6. Click **Submit complaint**. You'll see **"Submitting…"** for a second or two.
7. Land on the **confirmation** screen: a large **Complaint ID** — on a fresh run
   this is **CP-W14-0004**. *Say:* "Instant acknowledgement with a tracking ID —
   what a citizen doesn't get today."

> Keep this ID (CP-W14-0004) — you'll open it as the officer and track it as the
> citizen.

### Beat 2 — Duplicate prevention (stop redundant complaints)

1. In the header, click **Report** to start a new one.
2. **Type** → **Pothole**. **Street** → **Kaman Bhiwandi Road**. Add any
   description and the photo.
3. Click **Submit complaint**.
4. A **"Before you submit"** notice appears: *"Similar complaint may already exist
   nearby"* and lists **CP-W14-0001** (the seeded pothole on that street).
   - *Say:* "Before we create a fifth report of the same pothole, the citizen is
     shown the existing one. Fewer duplicates, cleaner queue for the officer."
5. Click **Go back** (don't submit the duplicate).

### Beat 3 — Track a complaint (transparency)

1. Header → **Track**.
2. First, type a wrong ID like `CP-W14-9999` → **Track**. It shows *"No complaint
   found with that ID."* — *Say:* "Handled cleanly, no crash."
3. Now type **CP-W14-0004** → **Track**. Shows the status timeline at **Submitted**.
   - *Say:* "The citizen can check progress any time. Remember this — I'll move it
     forward as the officer and we'll come back."

---

## ACT 2 — The officer side (the resolution problem today)

> There is no citizen→officer link in the UI (separate audiences). Reach the console
> by editing the address bar to **`/officer`**.

1. Go to **`/officer`**. The **Officer Console** loads as **Er. S. R. Patil, Ward
   Engineer** (display context only — no login built).
2. Point at the header line: **"… open · … overdue · … total"**. *Say:* "One glance:
   workload and what's breaching SLA. **CP-W14-0003** is red — already overdue."
3. Leave **Sort: Urgency** — overdue/at-risk float to the top. *Say:* "The officer
   isn't guessing what to do first; the system ranks by deadline."
4. Click **Map** → colored pins per street (red = overdue, amber = due soon, green =
   on track). *Say:* "Same queue, geographic view. Pins are representative, not
   surveyed." Click a pin → **Open complaint**.
5. Back to **List**. Switch **Sort → Newest** so the just-submitted
   **CP-W14-0004** is on top. Open it.
6. On the detail page, show the **AI assessment** card: **Severity 5/5** with a
   one-line reason. *Say:* "This is the AI reading that description — 'sewage',
   'overflowing', 'school' — and flagging it as critical. It **confirms the
   category, never changes it**; the human decides."
7. Point at the **SLA** countdown (12h for drainage) and the fields shown: type,
   department, street, description, photo, timestamps. *Say:* "Notice what is **not**
   here — no name, no phone, no email. Field staff physically cannot see citizen
   identity. That separation is built into the data, not a setting we can forget."
8. Click **Advance to Assigned**, then **Advance to In Progress**. *Say:* "One clear
   forward step at a time, with a timestamped history."

### Beat 4 — Close the loop (one system, both sides)

1. In the address bar go back to **`/track/CP-W14-0004`** (the citizen view).
2. The timeline now shows **Assigned → In Progress** — the officer's updates,
   reflected to the citizen automatically. *Say:* "Same complaint, one source of
   truth. The citizen sees real movement — that's the accountability piece."

---

## Resilience (optional — only if asked "what if the internet drops?")

1. In the proxy terminal press **Ctrl+C** to stop it (simulates dead network).
2. Submit any complaint from the Report page.
3. It still resolves **within ~4 seconds**, still assigns a severity, still reaches
   the confirmation screen — **no error, no hang**. *Say:* "When the AI is
   unreachable, the system falls back to a transparent rule-based score. The citizen
   never sees a failure." (Restart with `node server.js` to re-enable the live AI.)

---

## The one-line close

*"Today a complaint goes into a register and disappears. CivicPulse gives the citizen
an ID and a live status, gives the officer a triaged, deadline-ranked queue, keeps
citizen identity private by design, and keeps working even when the network doesn't.
That's what we can build on **your** data."*

---

## Quick reference — talk track anchors

- **Auto-routing:** type → department, no manual sorting.
- **AI triage:** real Gemini severity + reason; confirms category, never overrides.
- **Duplicate check:** same type + street within 7 days → prompt before submit.
- **SLA:** deterministic countdown per type (Pothole 72h, Water 24h, Garbage 12h,
  Drainage 12h, Streetlight 24h); overdue is computed, not guessed.
- **Privacy by design:** operational record carries no identity; contact details
  live in a separate store the officer views cannot read.
- **Resilience:** ~4s hard ceiling + rule-based fallback → never hangs, never errors.
