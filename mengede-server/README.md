# mengede-server

Express backend for Mengede: payment-receipt verification via [links.et](https://links.et), a
Gemini Interactions test endpoint, and a MongoDB-backed data API for profiles, conversations,
quiz results, and study plans.

## Setup

```bash
npm install
cp .env.example .env      # then fill in MONGODB_URI / LINKS_ET_API_KEY / GEMINI_API_KEY
npm run dev                # http://localhost:4000
```

## links.et

[links.et](https://links.et) fetches a payment receipt directly from the issuing Ethiopian
bank/wallet (telebirr, CBE, Zemen, Bank of Abyssinia, Awash, and others — 17+ providers) and
returns a parsed, provider-specific `receipt` object, rather than trusting whatever text a user
pastes in. Get an API key (starts with `vk_live_`) at
[links.et/dashboard/keys](https://links.et/dashboard/keys) and set `LINKS_ET_API_KEY`.

- `lib/linksEt.js` — the client. Submits with `waitMs` and polls if links.et returns a `202`
  (a busy bank can take over a minute synchronously — see
  [integration-flows.md](https://links.et/docs/integration-flows.md)), and follows their retry
  rules: auto-retries `429 rate_limited` once after `Retry-After`, but deliberately does
  **not** auto-retry a `502` or the code-less "busy bank" `400` with a fresh request — some
  receipt links (Siinqee) allow only ~5 views total, so an automated retry loop can burn
  through them. Those are surfaced to the caller instead.
- `lib/receiptParsing.js` — links.et's own docs say to "switch on `receipt.source`, never the
  host", and that amount fields are numbers on some providers and strings on others (`"100
  Birr"`, `"100 ETB"`). This file has the confirmed field mapping for the six providers
  documented in detail (telebirr, CBE PDF, CBE mobile JSON, Zemen, Bank of Abyssinia, Awash) and
  falls back to a best-effort generic parse — flagged as `amountConfirmed: false` — for the
  rest, since their exact field layout isn't in the public docs yet.
- `routes/verifyReceipt.js` — what the booking flow actually calls. Layers a Mongo-backed
  duplicate-receipt guard and an expected-amount check on top of the client above.
- `routes/linksEt.js` — thin pass-throughs (`/api/links/verify`, `/api/links/verify-image`,
  `/api/links/verify/:requestId`) for testing or future direct use.

## MongoDB

Point `MONGODB_URI` at any Mongo instance — a local one via Docker Compose, or a hosted one
(Atlas, etc). To run one locally:

```bash
docker-compose up -d db      # from the repo root; starts Mongo on localhost:27017
```

No migration step is needed — Mongoose creates collections and indexes on first use. Models
live in `models/index.js`: `StudentProfile`, `Conversation`, `Message`, `QuizResult`,
`StudyPlan`, `PlanTask`, `AiUsage`, and `UsedReceipt` (the last one replaces the old in-memory
duplicate-receipt guard so it survives server restarts).

If `MONGODB_URI` isn't set, the server still starts (with a warning), but every route under
`/api/data/*` and receipt verification's duplicate check will fail until it's configured.

## Endpoints

- `POST /api/verify-receipt` — verifies a pasted payment reference against the real Links.et
  API (`lib/linksEt.js`) and records it in Mongo so it can't be reused.
- `POST /api/links/verify`, `POST /api/links/verify-image` — the Links.et client directly.
- `POST /api/test/gemini` — calls Gemini (or returns a simulated response if `GEMINI_API_KEY`
  is unset) and logs real calls to the `AiUsage` collection.
- `/api/data/*` — CRUD for student profiles, conversations + messages, quiz results, and study
  plans + tasks. See `routes/data.js` for the full list.

## Intelligence and university exploration

The active branch includes verified university/program relationships, User Intelligence signals,
recommendation ranking, conversation-state estimation, resource discovery, ScholarXIV paper
discovery, and persisted exploration roadmaps. Program relationships are evidence-backed and
should not be inferred from department names alone.

Key endpoints include `/api/universities`, `/api/programs`, `/api/resources/discover`,
`/api/interactions`, and `/api/recommendations`. The assistant route feeds profile and
intelligence context into Gemini and returns the conversation state estimate used to adjust
response style without diagnosing the student.

## Knowledge Base and RAG

Mengede keeps structured facts in the MongoDB catalog (universities, pathways, and evidence-backed university-program relationships). RAG stores document chunks plus Gemini embeddings in the `KnowledgeChunk` collection and retrieves relevant passages for the assistant prompt. Retrieved text is treated as evidence, never as instructions.

### Configure and index the program catalog

Set these server-side values in `.env`:

```env
GEMINI_API_KEY=your_server_side_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
KNOWLEDGE_INGEST_KEY=use-a-long-random-secret
```

Then run from `mengede-server`:

```bash
npm run index:knowledge
```

The script embeds the existing university-program catalog records and stores the vectors in MongoDB. Re-run it after changing that catalog. It requires a working Gemini API key and MongoDB connection.

### Knowledge API

- `GET /api/knowledge/search?q=computer%20science` — semantic search over indexed chunks.
- `POST /api/knowledge/ingest` — index a trusted text document. Send `x-knowledge-ingest-key: <KNOWLEDGE_INGEST_KEY>` and JSON containing `title`, `sourceUrl`, `sourceType`, and `text`. Supported source types include `university`, `program`, `legislation`, `published_paper`, `official_document`, `research`, and `other`.

The initial implementation scans up to 5,000 stored vectors in application memory and ranks them by cosine similarity. This is intentionally a small curated-corpus implementation; move to a MongoDB Atlas Vector Search index before scaling to a large document collection. Only ingest material you are permitted to store, and review source freshness and evidence before promoting claims to the structured catalog.
