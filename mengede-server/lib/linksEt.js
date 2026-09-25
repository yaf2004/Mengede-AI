import 'dotenv/config';
import crypto from 'crypto';

// Client for links.et (https://links.et/agents.md, https://links.et/llms-full.txt).
// Verifies Ethiopian payment receipts (telebirr, CBE, Zemen, Bank of Abyssinia, Awash,
// and others) at the source, so we don't have to trust whatever a user pastes in.

const BASE = process.env.LINKS_ET_BASE_URL || 'https://links.et';
const API_KEY = process.env.LINKS_ET_API_KEY;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterMs(headers) {
  const ra = headers.get('retry-after');
  if (!ra) return null;
  const n = Number(ra);
  if (!Number.isNaN(n)) return n * 1000; // seconds, per the docs
  const date = Date.parse(ra);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

async function rawRequest(path, init = {}) {
  if (!API_KEY) throw new Error('LINKS_ET_API_KEY is not set.');

  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', API_KEY);
  if (init.body) headers.set('content-type', 'application/json');

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { ok: false, error: { code: 'invalid_json_response', message: text } };
  }
  return { status: res.status, body, headers: res.headers };
}

/**
 * POST /api/verify with links.et's own retry/backoff rules applied, per
 * https://links.et/docs/errors.md and https://links.et/docs/integration-flows.md:
 *
 *  - 400 invalid_json / invalid_request, 401 *, 429 quota_exceeded / image_cap_reached,
 *    503 ai_not_configured -> returned as-is, never retried here. These need a code
 *    change, a new key, or a plan change, not a retry loop.
 *  - 429 rate_limited -> we wait `Retry-After` (once) and try again automatically,
 *    since that's a short, well-defined wait.
 *  - 502 / 400 with no `error.code` ("busy bank") and 503 provider_down are NOT
 *    retried automatically here with a *fresh* request. A links.et retry with a new
 *    Idempotency-Key spends a fresh upstream attempt, and for metered receipts
 *    (Siinqee allows ~5 views total) an automated retry loop can burn through the
 *    receipt's remaining views. We surface the error to the caller instead, who can
 *    decide whether a human-initiated retry is worth it. Reusing the *same*
 *    Idempotency-Key just replays the identical result, so it wouldn't help anyway.
 *  - A thrown fetch (network blip, DNS, etc. — never reached links.et) is retried
 *    once with the same idempotency key, since nothing was spent upstream.
 */
async function requestWithRetry(path, { method = 'POST', body, idempotencyKey } = {}) {
  const headers = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  let lastNetworkError;
  for (let networkAttempt = 1; networkAttempt <= 2; networkAttempt++) {
    let res;
    try {
      res = await rawRequest(path, init);
    } catch (err) {
      lastNetworkError = err;
      if (networkAttempt < 2) {
        await sleep(500);
        continue;
      }
      throw err;
    }

    if (res.status >= 200 && res.status < 300) return res;

    const code = res.body?.error?.code || null;

    // 429 rate_limited: short, well-defined wait, safe to retry once automatically.
    if (res.status === 429 && code === 'rate_limited') {
      const wait = parseRetryAfterMs(res.headers) ?? 2000;
      await sleep(wait);
      const retried = await rawRequest(path, init);
      return retried;
    }

    // Everything else (invalid_request, missing/invalid/revoked key, quota_exceeded,
    // image_cap_reached, ocr_daily_cap_reached, provider_down, ai_not_configured,
    // the code-less 400 "busy bank", and the code-less 502 "parsed but invalid") is
    // returned as-is for the caller to interpret. See requestWithRetry's docstring.
    return res;
  }
  // Unreachable, but keeps the linter happy about a guaranteed return.
  throw lastNetworkError;
}

/**
 * Polls GET /api/verify/:requestId until it resolves (`completed` or `failed`) or
 * `maxWaitMs` elapses. Used after a `202` from `verify()`. See
 * https://links.et/docs/integration-flows.md#polling — this repo uses polling rather
 * than SSE since the caller is our own Express route, not a browser.
 */
async function pollVerify(requestId, { maxWaitMs = 20000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const res = await rawRequest(`/api/verify/${requestId}`, { method: 'GET' });
    const status = res.body?.processingStatus;
    if (status === 'completed' || status === 'failed' || res.status !== 202) {
      return res;
    }
  }
  return null; // still queued when we gave up
}

/**
 * Verifies one receipt. Exactly one of `url` / `reference` (telebirr-only shorthand)
 * is expected, per https://links.et/docs/verify.md.
 *
 * Submits with `waitMs` so links.et holds the connection for cached/fast receipts and
 * hands back a `requestId` to poll otherwise, rather than us holding an HTTP socket
 * open for the worst case (over a minute against a busy bank — see integration-flows.md).
 * If the receipt still hasn't resolved after `maxTotalWaitMs`, the result has
 * `processingStatus: 'queued'` and a `requestId` the caller can look up later.
 */
export async function verify({ url, reference, idempotencyKey, waitMs = 12000, maxTotalWaitMs = 25000 } = {}) {
  const payload = {};
  if (url) payload.url = url;
  if (reference) payload.reference = reference;
  payload.waitMs = Math.min(Number(waitMs) || 0, 30000); // links.et clamps this server-side too

  const key = idempotencyKey || crypto.randomUUID();
  const first = await requestWithRetry('/api/verify', { body: payload, idempotencyKey: key });

  if (first.status !== 202) return first;

  const requestId = first.body?.requestId;
  if (!requestId) return first; // shouldn't happen, but don't crash on a malformed 202

  const remaining = Math.max(0, maxTotalWaitMs - Number(waitMs));
  const resolved = remaining > 0 ? await pollVerify(requestId, { maxWaitMs: remaining }) : null;

  return resolved || first; // still-queued 202 (with requestId + statusUrl) if we gave up
}

/**
 * Looks up a previously submitted verification by request id — for a caller that
 * received a `queued` result from `verify()` earlier and wants to check on it later.
 */
export async function getVerifyStatus(requestId) {
  return rawRequest(`/api/verify/${encodeURIComponent(requestId)}`, { method: 'GET' });
}

/**
 * POST /api/verify-image. Accepts 1–5 base64 images of the same receipt; see
 * https://links.et/docs/verify-image.md. Only telebirr is auto-verified end-to-end
 * from a screenshot alone (the reference is enough to reconstruct the lookup URL);
 * for CBE/BOA/Zemen/Awash, `upstream.attempted` will be false with
 * `reason: 'provider_needs_full_url'` unless the screenshot happens to show the URL.
 */
export async function verifyImage({ images, imageBase64, idempotencyKey } = {}) {
  const payload = images ? { images } : { imageBase64 };
  return requestWithRetry('/api/verify-image', { body: payload, idempotencyKey });
}

export function isLinksEtConfigured() {
  return Boolean(API_KEY);
}
