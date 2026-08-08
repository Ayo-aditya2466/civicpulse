# CivicPulse — Requirements & Installation

Everything needed to run the prototype on a fresh machine.

> **Note on format:** CivicPulse is a Node.js project, so there is no Python-style
> `requirements.txt`. Dependencies are declared in the two `package.json` files and
> installed with `npm install`. This document lists them for reference and gives the
> exact install steps.

---

## System prerequisites

| Tool | Minimum | Verified on | Notes |
|---|---|---|---|
| **Node.js** | 18+ | v24.18.1 | Proxy uses built-in `fetch`/`AbortController` (Node 18+). |
| **npm** | 9+ | 11.16.0 | Ships with Node. |
| **Modern browser** | — | Chrome/Edge/Firefox | For the client UI. |
| **Google Gemini API key** | optional | — | Enables the live AI severity call. Without it, the app uses the deterministic fallback — nothing breaks. |

---

## Install everything (quick start)

```bash
# 1. Client (React app)
cd client
npm install

# 2. Proxy (Express + Gemini)
cd ../proxy
npm install
```

Then run them (two terminals):

```bash
# Terminal 1 — proxy on http://localhost:3001
cd proxy && node server.js

# Terminal 2 — client (Vite prints the URL, usually http://localhost:5173)
cd client && npm run dev
```

### Gemini API key (optional, for the live AI path)

Create **`proxy/.env`** (gitignored — never commit it):

```
GEMINI_API_KEY=your_key_here
```

Without this file the proxy returns a non-2xx from `/classify` and the client silently
falls back to deterministic keyword-based severity.

---

## Client dependencies (`client/package.json`)

**Runtime**

| Package | Version |
|---|---|
| react | ^19.2.8 |
| react-dom | ^19.2.8 |
| react-router-dom | ^7.18.2 |
| tailwindcss | ^4.3.3 |
| @tailwindcss/vite | ^4.3.3 |
| leaflet | ^1.9.4 |
| react-leaflet | ^5.0.0 |
| lucide-react | ^1.30.0 |

**Dev / build**

| Package | Version |
|---|---|
| vite | ^8.2.0 |
| @vitejs/plugin-react | ^6.0.4 |
| eslint | ^10.8.0 |
| @eslint/js | ^10.0.1 |
| eslint-plugin-react-hooks | ^7.1.1 |
| eslint-plugin-react-refresh | ^0.5.3 |
| globals | ^17.7.0 |
| @types/react | ^19.2.17 |
| @types/react-dom | ^19.2.3 |

---

## Proxy dependencies (`proxy/package.json`)

| Package | Version |
|---|---|
| express | ^5.2.1 |
| cors | ^2.8.6 |
| dotenv | ^17.4.2 |

---

## What is **not** required

- No database (data lives in the browser's `localStorage`).
- No global CLI installs beyond Node/npm.
- No paid services to run the demo — the Gemini key is optional; the app is fully
  functional on the deterministic fallback.
