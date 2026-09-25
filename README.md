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

`mengede-server` needs these to do real work — the frontend still runs without them, but
receipt verification and the data API won't.

- **MongoDB (required for the data API and receipt de-duplication):** copy the root
  `.env.example` to `.env` and set `MONGODB_URI` (a local Mongo via
  `docker-compose up -d db`, or Atlas/any hosted Mongo). No migrations needed — Mongoose
  creates collections and indexes on first use. See `mengede-server/README.md`.
- **links.et (required for real receipt verification):** set `LINKS_ET_API_KEY` (starts with
  `vk_live_`, from [links.et/dashboard/keys](https://links.et/dashboard/keys)). Without it,
  `POST /api/verify-receipt` returns a clear 503 instead of silently accepting payments. See
  `mengede-server/README.md` for how the client handles links.et's async/retry behavior.
- **Gemini (optional):** set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) to call the real
  Interactions API from `lib/gemini.js`; without a key it returns a simulated response so local
  dev still works. Reachable via the test endpoint (`POST /api/test/gemini`, or
  `node test_gemini.js`); real calls are now logged per-user, per-day to the `AiUsage`
  collection in Mongo. No page in the frontend calls it yet — the Assistant page talks to
  Voxide's own AI directly, not Gemini.

## What's real vs. mocked

**Real, working code:**
- The whole frontend is componentized (Sidebar, Orb, GlassToggle, pages, contexts for
  theme/settings/app state) — no CDN Tailwind, built with `@tailwindcss/vite`.
- The booking flow is fully wired: free mentors book instantly, paid mentors go through a
  real `POST /api/verify-receipt` call to the Express backend, which calls the real
  [links.et](https://links.et) API (`lib/linksEt.js`) to confirm the receipt directly with the
  bank, and persists used receipts in MongoDB (`UsedReceipt`) so a receipt can't be reused even
  across server restarts. **Requires `LINKS_ET_API_KEY` and `MONGODB_URI` to be set** — without
  them the route returns a clear error instead of silently accepting payments.
- The voice assistant is real: `@voxide/react` handles speech-to-text, the AI agent and voice
  replies. The agent can navigate the app, list mentors, book free sessions and save profile
  details through capabilities registered in `mengede-web/src/lib/voxide.js`.
- Dark mode, voice settings, and language preference persist to `localStorage`.
- `mengede-server/lib/linksEt.js` makes genuine calls to the links.et API (`/api/verify`,
  `/api/verify-image`) when `LINKS_ET_API_KEY` is set: it submits with `waitMs` and polls on a
  `202` rather than holding a socket open through a slow bank, and follows links.et's retry
  guidance (auto-retry `rate_limited`, but not `502`/busy-bank `400`, to protect view-limited
  receipts like Siinqee's). `lib/receiptParsing.js` normalizes the per-provider `receipt` shape
  into a plain `{ bank, amount }` for the six providers links.et's docs describe in detail;
  other supported banks get a best-effort parse flagged as unconfirmed.
- `mengede-server/lib/gemini.js` makes genuine calls to the Gemini Interactions API when
  `GEMINI_API_KEY` is set, with a retry ladder for rate limits/server errors; real calls are
  now tracked per-user, per-day in the `AiUsage` Mongo collection.
- A real MongoDB-backed data API (`/api/data/*`, see `mengede-server/routes/data.js`) covers
  student profiles, conversations + messages, quiz results, and study plans + tasks —
  replacing the earlier Postgres/Drizzle scaffold that nothing actually read from.

**Still mocked or not yet wired together (clearly commented at the point where it matters):**
- Amount verification is only confirmed for six providers (telebirr, CBE PDF, CBE mobile JSON,
  Zemen, Bank of Abyssinia, Awash) — the ones links.et's docs describe field-by-field. A receipt
  from any other supported bank is still confirmed by the bank itself, but the booking flow
  reports the amount as unverified (`amountVerified: false`) rather than guessing at field names
  links.et hasn't documented yet.
- If a verification takes unusually long (a busy or struggling bank), `/api/verify-receipt` can
  return a `202 { pending: true }` after ~25s instead of a final result. The current frontend
  doesn't retry on this automatically yet — that's the next piece to wire up.
- Nothing in the frontend calls the new `/api/data/*` endpoints yet — profile, conversation,
  quiz, and study-plan data are still only kept in frontend state/`localStorage`, not persisted
  to Mongo, until the relevant pages are wired up to call them.
- The Gemini test endpoint is real but isolated — nothing in the UI surfaces it yet; the
  Assistant page talks to Voxide's own AI, not Gemini.
- The two mentors' payment details in `mengede-web/src/data/mentors.js` (`pay.account`) are
  placeholders — replace with their real Telebirr/bank numbers.
- The Voxide agent's own instructions (persona, language, honesty rules) live in the Voxide
  dashboard, not in this repo. Set them there, and add the production domain to the whitelist.
- Amharic language setting is cosmetic — there's no translation layer behind it yet.
