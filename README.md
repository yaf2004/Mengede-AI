# Mengede

A proper two-part project (not a single HTML mockup): a componentized React + Vite frontend,
and a small Express backend that owns payment verification.

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

## What's real vs. mocked

**Real, working code:**
- The whole frontend is componentized (Sidebar, Orb, GlassToggle, pages, contexts for
  theme/settings/app state) — no CDN Tailwind, built with `@tailwindcss/vite`.
- The booking flow is fully wired: free mentors book instantly, paid mentors go through a
  real `POST /api/verify-receipt` call to the Express backend — this is a genuine
  frontend/backend round trip, not a client-side fake.
- The backend validates empty/short input and rejects duplicate receipts (in-memory). Its
  amount check is not meaningful yet: the mock echoes back whatever amount the browser sends,
  so **any 8+ character string currently counts as a valid payment**. Do not present payment
  verification as working until the Links.et call is real.
- The voice assistant is real: `@voxide/react` handles speech-to-text, the AI agent and voice
  replies. The agent can navigate the app, list mentors, book free sessions and save profile
  details through capabilities registered in `mengede-web/src/lib/voxide.js`.
- Dark mode, voice settings, and language preference persist to `localStorage`.

**Still mocked (clearly commented at the point where it matters):**
- `mengede-server/routes/verifyReceipt.js` fabricates the bank name from the reference text
  and assumes the paid amount is correct — it does not call the real Links.et API. The exact
  `fetch(...)` call to make, and where your `LINKS_ET_API_KEY` goes (server-side `.env` only,
  never the frontend), is written directly above the mock code.
- The duplicate-receipt check is an in-memory `Map` that resets on server restart. Swap it
  for a real database table before this goes live.
- The two mentors' payment details in `mengede-web/src/data/mentors.js` (`pay.account`) are
  placeholders — replace with their real Telebirr/bank numbers.
- The Voxide agent's own instructions (persona, language, honesty rules) live in the Voxide
  dashboard, not in this repo. Set them there, and add the production domain to the whitelist.
- Amharic language setting is cosmetic — there's no translation layer behind it yet.
