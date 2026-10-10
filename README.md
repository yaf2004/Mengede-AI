# Mengede

A two-part project: a componentized React + Vite frontend, and a small Express backend that
owns payment verification.

```
mengede/
├── mengede-web/      React + Vite + Tailwind v4 frontend
└── mengede-server/   Express backend (real Links.et receipt verification, MongoDB data API)
```

## Running it

```bash
# Terminal 1 — backend
cd mengede-server
npm install
cp .env.example .env
npm run dev            # http://localhost:4000

# Terminal 2 — frontend
cd mengede-web
npm install
npm run dev             # http://localhost:5173, proxies /api/* to :4000
```

## Voxide setup

`mengede-web/.env.example` has the publishable key (safe in the browser). Copy it to `.env` to
override per environment. In the Voxide dashboard: set the agent language and prompt, and add
your deployed domain to the whitelist (`localhost` always works). Microphone access needs HTTPS
when deployed.

## Backend setup: MongoDB, Gemini, and Links.et

`mengede-server` needs these to do real work — the frontend can render without them, but
Mongo-backed data, receipt verification, and some intelligence/resource features will be limited.

- **MongoDB (required for the data API and receipt de-duplication):** copy the root
  `.env.example` to `.env` and set `MONGODB_URI` (a local Mongo via
  `docker-compose up -d db`, or Atlas/any hosted Mongo). No migrations needed — Mongoose
  creates collections and indexes on first use. See `mengede-server/README.md`.
- **links.et (required for real receipt verification):** set `LINKS_ET_API_KEY` (starts with
  `vk_live_`, from [links.et/dashboard/keys](https://links.et/dashboard/keys)). Without it,
  `POST /api/verify-receipt` returns a clear 503 instead of silently accepting payments. See
  `mengede-server/README.md` for how the client handles links.et's async/retry behavior.
- **Gemini (optional):** set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) to call the real
  Interactions API from `lib/gemini.js`; without a key the backend falls back to deterministic
  reasoning so local dev still works. The Mengede assistant pipeline uses Gemini when available
  and preserves the conversation/User Intelligence context regardless of the provider path.
- **ScholarXIV (optional):** set `SCHOLARXIV_API_KEY` to add research-paper discovery to the
  resource pipeline. When the key is absent or the API is unavailable, normal resource discovery
  continues without papers.

## What's real vs. mocked

**Real, working code:**
- The whole frontend is componentized (Sidebar, Orb, GlassToggle, pages, contexts for theme/settings/app state) — no CDN Tailwind, built with `@tailwindcss/vite`.
- The booking flow is fully wired: free mentors book instantly, while paid mentors use `POST /api/verify-receipt`, links.et, and Mongo-backed receipt de-duplication.
- Voxide remains the voice interface. Its capabilities navigate the app, update the profile, list mentors, book free sessions, and send university/career/pathway questions through `askMengede` into the backend intelligence pipeline.
- The active backend uses MongoDB/Mongoose; the old Postgres/Drizzle scaffold is no longer part of the active branch.
- The assistant pipeline loads profile + User Intelligence + catalog context, estimates short-term conversation state, uses Gemini for structured reasoning when available, and falls back to deterministic reasoning when Gemini/search is unavailable.
- University exploration uses verified program-level relationships through `/api/universities` and `/api/programs`; it does not infer an undergraduate program merely from a department name.
- Interaction signals update User Intelligence and feed recommendations. University/pathway exploration, saves, resource interactions, roadmap creation, and roadmap progress are represented as evidence.
- Pathway exploration can generate a persisted roadmap and tasks in MongoDB; completing roadmap tasks feeds intelligence signals.
- Resource discovery combines grounded Gemini/YouTube discovery with optional ScholarXIV paper discovery when `SCHOLARXIV_API_KEY` is configured.
- Dark mode, voice settings, and language preference persist to `localStorage`.

**Still mocked or intentionally incomplete:**
- Amount verification is only confirmed for the six provider formats documented in detail by links.et; other supported banks may report `amountVerified: false`.
- A slow links.et verification can return `202 { pending: true }`; automatic frontend retry is not yet implemented.
- Mentor payment account values in `mengede-web/src/data/mentors.js` remain placeholders and must be replaced with real payment details before accepting paid-session submissions.
- Voxide persona/instructions live in the Voxide dashboard; the deployed domain must be whitelisted there. HTTPS is required for microphone access in production.
- Amharic language selection changes the Voxide locale but does not yet provide a full application translation layer.
