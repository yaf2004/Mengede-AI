# CHANGELOG

## Unreleased

- feat: `lib/linksEt.js` rewritten against the actual links.et API (read from
  https://links.et/agents.md and the linked docs), replacing the earlier version's assumed
  `{ verified, bank, amount }` response shape with the real envelope
  (`{ ok, providerKey, receipt: {...} }`) and per-provider `receipt` fields.
- feat: added `waitMs` + polling support for links.et's async flow (`202` + `requestId` when a
  bank is slow to answer), instead of blindly holding an HTTP request open indefinitely.
- feat: `lib/receiptParsing.js` — normalizes each provider's `receipt` object into a plain
  `{ bank, amount }`, since links.et's amount fields are numbers for some banks and strings like
  `"100 Birr"` for others, and field names differ per `receipt.source`.
- fix: retry behavior now matches links.et's own guidance — `429 rate_limited` is retried once
  automatically, but `502` and the code-less "busy bank" `400` are surfaced to the caller rather
  than retried with a fresh request, since a retry can burn through the ~5 total views a metered
  receipt (Siinqee) allows.
- fix: `routes/verifyReceipt.js` now calls the real client and maps links.et's documented error
  codes (`invalid_request`, `quota_exceeded`, `provider_down`, etc.) to user-facing messages,
  instead of fabricating a bank/amount from the pasted reference. Requires `LINKS_ET_API_KEY`.
- feat: duplicate-receipt checking moved from an in-memory `Map` to a persisted `UsedReceipt`
  collection in MongoDB, so it survives restarts.
- feat: replaced the Postgres/Drizzle scaffold with a working MongoDB backend (Mongoose models
  in `models/index.js`) and a real `/api/data/*` REST API for student profiles, conversations +
  messages, quiz results, and study plans + tasks.
- fix: removed a leftover duplicate `/api/test/gemini` route definition inside the server's
  `listen` callback in `server.js`; there is now exactly one Gemini route.
- feat: real (non-simulated) Gemini calls are now tracked per-user, per-day in a new `AiUsage`
  Mongo collection via `incrementAiUsage()`.
- chore: removed `pg`, `drizzle-orm`, `drizzle-kit` and the `drizzle/` folder; added `mongoose`.
- chore: `docker-compose.yml` now runs MongoDB instead of Postgres; `.env.example` files use
  `MONGODB_URI` instead of `DATABASE_URL`/`DATABASE_URL_DIRECT`, and `LINKS_ET_BASE_URL`
  corrected to `https://links.et` (was pointing at the non-existent `api.links.et`).
- docs: updated both READMEs to describe the MongoDB setup and the real links.et integration,
  including its async/retry behavior and the providers whose amount field is confirmed.

