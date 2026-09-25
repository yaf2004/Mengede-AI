# Mengede

A two-part project: a componentized React + Vite frontend, and a small Express backend that
owns payment verification.

```
mengede/
├── mengede-web/      React + Vite + Tailwind v4 frontend
└── mengede-server/   Express backend (mock receipt verification via Links.et)
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

## Optional: Postgres, Gemini, and Links.et

These are scaffolded in `mengede-server` but not required to run the app day-to-day.

- **Postgres (Drizzle):** copy the root `.env.example` to `.env` and set `DATABASE_URL` (a local
  Docker Postgres via `docker-compose up -d db`, or Neon/hosted Postgres both work — use
  `DATABASE_URL_DIRECT` for the unpooled connection Neon recommends for migrations). Then, from
  `mengede-server`: `npm run db:generate` to (re)generate migrations and `npm run db:migrate` to
  apply them. See `mengede-server/README.md`. Nothing in the app reads from this database yet —
  the schema and migration exist, but no route queries them.
- **Gemini:** set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) to call the real Interactions
  API from `lib/gemini.js`; without a key it returns a simulated response so local dev still
  works. Reachable today only via the test endpoint (`POST /api/test/gemini`, or
  `node test_gemini.js`) — no page in the frontend calls it yet.
- **Links.et:** set `LINKS_ET_API_KEY` to enable `lib/linksEt.js`, a real client for
  `POST /api/verify` and `POST /api/verify-image` against `https://links.et`, with retry/backoff
  handling for rate limits and provider errors. It's mounted at `/api/links/*` and works standalone,
  but the booking flow does **not** call it yet — see below.

## What's real vs. mocked

**Real, working code:**
- The whole frontend is componentized (Sidebar, Orb, GlassToggle, pages, contexts for
  theme/settings/app state) — no CDN Tailwind, built with `@tailwindcss/vite`.
- The booking flow is fully wired: free mentors book instantly, paid mentors go through a
  real `POST /api/verify-receipt` call to the Express backend — this is a genuine
  frontend/backend round trip, not a client-side fake.
- The backend validates empty/short input and rejects duplicate receipts (in-memory).
- The voice assistant is real: `@voxide/react` handles speech-to-text, the AI agent and voice
  replies. The agent can navigate the app, list mentors, book free sessions and save profile
  details through capabilities registered in `mengede-web/src/lib/voxide.js`.
- Dark mode, voice settings, and language preference persist to `localStorage`.
- `mengede-server/lib/linksEt.js` + `routes/linksEt.js` make genuine calls to the Links.et API
  (`/api/verify`, `/api/verify-image`) when `LINKS_ET_API_KEY` is set, including its retry rules
  for rate limits, `502`s, and provider downtime.
- `mengede-server/lib/gemini.js` makes genuine calls to the Gemini Interactions API when
  `GEMINI_API_KEY` is set, with a retry ladder for rate limits/server errors.

**Still mocked or not yet wired together (clearly commented at the point where it matters):**
- `mengede-server/routes/verifyReceipt.js` — the route the booking flow actually calls — still
  fabricates the bank name from the reference text and assumes the paid amount is correct; it
  does not call the real Links.et client above, so **any 8+ character string currently counts
  as a valid payment**. The exact call needed to replace it with `lib/linksEt.js`'s `verify()` is
  written directly above the mock code. Do not present payment verification as working until
  this route is switched over.
- The duplicate-receipt check is an in-memory `Map` that resets on server restart. Swap it for a
  real database table (the Postgres/Drizzle scaffold above) before this goes live.
- The Drizzle schema and migration exist but haven't been run against a real database, and no
  route reads or writes through them yet.
- The Gemini test endpoint is real but isolated — nothing in the UI surfaces it yet.
- The two mentors' payment details in `mengede-web/src/data/mentors.js` (`pay.account`) are
  placeholders — replace with their real Telebirr/bank numbers.
- The Voxide agent's own instructions (persona, language, honesty rules) live in the Voxide
  dashboard, not in this repo. Set them there, and add the production domain to the whitelist.
- Amharic language setting is cosmetic — there's no translation layer behind it yet.
