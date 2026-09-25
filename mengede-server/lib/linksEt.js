import 'dotenv/config';

const BASE = 'https://links.et';
const API_KEY = process.env.LINKS_ET_API_KEY;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfter(res) {
  const ra = res.headers.get('retry-after');
  if (!ra) return null;
  const n = Number(ra);
  if (!Number.isNaN(n)) return n * 1000;
  const date = Date.parse(ra);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

async function doFetch(path, init = {}) {
  if (!API_KEY) throw new Error('LINKS_ET_API_KEY not set');

  const url = `${BASE}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', API_KEY);
  headers.set('content-type', 'application/json');

  const opts = { ...init, headers };

  // Retry strategy:
  // - 401, 400 invalid_request/invalid_json, 429 quota_exceeded/image_cap_reached -> no retry
  // - 429 rate_limited -> wait Retry-After then retry
  // - 502 -> retry 1-2s with jitter up to 3 attempts
  // - 503 provider_down -> wait Retry-After and do not retry aggressively
  // - 400 (none) busy/bank wait -> retry with backoff up to 3 attempts

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, opts);
    const text = await res.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = { ok: false, error: { code: 'invalid_json_response', message: text } }; }

    // Success
    if (res.status >= 200 && res.status < 300) return { status: res.status, body, headers: res.headers };

    // Parse error envelope
    const err = body && body.error ? body.error : null;
    const code = err?.code || null;

    // No-retry cases
    if (res.status === 401) return { status: res.status, body, headers: res.headers };
    if (res.status === 400 && (code === 'invalid_json' || code === 'invalid_request')) return { status: res.status, body, headers: res.headers };
    if (res.status === 429 && (code === 'quota_exceeded' || code === 'image_cap_reached')) return { status: res.status, body, headers: res.headers };
    if (res.status === 503 && code === 'ai_not_configured') return { status: res.status, body, headers: res.headers };

    // Retry-able scenarios
    // 429 rate_limited -> wait Retry-After
    if (res.status === 429 && code === 'rate_limited') {
      const wait = parseRetryAfter(res) || (attempt * 1000);
      await sleep(wait + Math.floor(Math.random() * 500));
      continue;
    }

    // 503 provider_down -> wait Retry-After but don't spin too long
    if (res.status === 503 && code === 'provider_down') {
      const wait = parseRetryAfter(res) || 300000; // default 5m
      // return the error to caller so they can decide; do one attempt after wait only if attempts left
      if (attempt < maxAttempts) {
        await sleep(wait);
        continue;
      }
      return { status: res.status, body, headers: res.headers };
    }

    // 502 or 400 (without code) -> retry with short backoff
    if (res.status === 502 || (res.status === 400 && !code)) {
      if (attempt < maxAttempts) {
        const backoff = 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
        await sleep(backoff);
        continue;
      }
      return { status: res.status, body, headers: res.headers };
    }

    // Fallback: return whatever we got
    return { status: res.status, body, headers: res.headers };
  }
  return { status: 500, body: { ok: false, error: { code: 'retry_failed', message: 'Exceeded retry attempts' } }, headers: new Headers() };
}

export async function verify({ url, reference, waitMs, idempotencyKey } = {}) {
  const payload = {};
  if (url) payload.url = url;
  if (reference) payload.reference = reference;
  if (waitMs != null) payload.waitMs = Number(waitMs);

  const headers = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await doFetch('/api/verify', { method: 'POST', body: JSON.stringify(payload), headers });
  return res;
}

export async function verifyImage({ images, idempotencyKey } = {}) {
  const payload = {};
  if (images) payload.images = images;
  const headers = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await doFetch('/api/verify-image', { method: 'POST', body: JSON.stringify(payload), headers });
  return res;
}
