import { Router } from 'express';
import { verify, isLinksEtConfigured } from '../lib/linksEt.js';
import { normalizeReceipt } from '../lib/receiptParsing.js';
import { UsedReceipt } from '../models/index.js';

const router = Router();

// Friendly copy for links.et's error codes. See https://links.et/docs/errors.md.
// Anything not listed here (including the code-less 400 "busy bank" case and the
// code-less 502 "bank answered but receipt didn't validate" case) falls through to
// the generic message below.
const ERROR_MESSAGES = {
  invalid_request: "That doesn't look like a valid receipt link or reference.",
  invalid_json: "That doesn't look like a valid receipt link or reference.",
  missing_key: 'Payment verification is not configured on this server.',
  invalid_key: 'Payment verification is not configured correctly on this server.',
  revoked_key: 'Payment verification is not configured correctly on this server.',
  quota_exceeded: "We've hit our verification limit for this billing period — contact support.",
  rate_limited: 'Too many verification attempts right now — please try again in a moment.',
  provider_down: "The bank's system is temporarily unreachable. Try again in a few minutes.",
  ai_not_configured: 'Receipt verification is temporarily unavailable. Try again shortly.',
};

// A receipt reference/URL is effectively a credential for someone's bank transaction —
// links.et's own docs say not to log it. We log a normalized key derived from it (for
// dedup) but never the raw value itself.
function hashKey(ref) {
  return ref.trim().toLowerCase();
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value);
}

router.post('/', async (req, res) => {
  const { reference, expectedAmount } = req.body || {};
  const ref = typeof reference === 'string' ? reference.trim() : '';

  if (!ref) {
    return res.status(400).json({ ok: false, error: 'Paste the receipt link or reference first.' });
  }
  if (ref.length < 8) {
    return res.status(400).json({ ok: false, error: 'That reference looks too short — paste the full link or code.' });
  }
  if (!isLinksEtConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'Payment verification is not configured on this server (LINKS_ET_API_KEY is missing).',
    });
  }

  const key = hashKey(ref);

  // Persisted in Mongo so a receipt can't be reused, even across server restarts or
  // multiple instances (the old mock kept this in an in-memory Map).
  const alreadyUsed = await UsedReceipt.findOne({ reference_key: key });
  if (alreadyUsed) {
    return res.status(409).json({ ok: false, error: 'This receipt has already been used for another booking.' });
  }

  // telebirr accepts a bare reference; every other provider needs the full receipt URL.
  const payload = looksLikeUrl(ref) ? { url: ref } : { reference: ref };

  let result;
  try {
    result = await verify({ ...payload, idempotencyKey: key });
  } catch (err) {
    console.error('links.et verify() threw (network-level failure)', err.message);
    return res.status(502).json({ ok: false, error: 'Could not reach the verification service right now. Please try again.' });
  }

  // Still queued after our poll budget: the bank is unusually slow. Rather than fail,
  // tell the caller so the UI can show "still checking" and retry the same reference
  // shortly — retrying re-sends the same Idempotency-Key, so it's safe and won't spend
  // a second upstream lookup.
  if (result.processingStatus === 'queued') {
    return res.status(202).json({
      ok: false,
      pending: true,
      error: "Still checking with the bank — this can take a little longer than usual. Try again in a few seconds.",
    });
  }

  if (result.status < 200 || result.status >= 300) {
    const code = result.body?.error?.code;
    const message = ERROR_MESSAGES[code] || result.body?.error?.message || 'We could not verify that receipt.';
    // 502 here means links.et reached the bank but the page didn't parse as a valid
    // receipt (see links.et/docs/verify.md's "502: parsed but invalid").
    return res.status(result.status).json({ ok: false, error: message });
  }

  const { bank, amount, amountConfirmed, metered } = normalizeReceipt(result.body);

  if (typeof expectedAmount === 'number' && amountConfirmed && amount !== expectedAmount) {
    return res.status(400).json({
      ok: false,
      error: `The bank reports ETB ${amount.toLocaleString()}, which doesn't match the ETB ${expectedAmount.toLocaleString()} expected for this session.`,
    });
  }
  if (typeof expectedAmount === 'number' && !amountConfirmed) {
    // We got a genuine bank confirmation but don't yet have a confirmed field mapping
    // for this provider's amount — don't silently wave through an unchecked amount.
    return res.status(200).json({
      ok: true,
      bank,
      amount: null,
      amountVerified: false,
      reference: ref,
      warning: 'Receipt confirmed by the bank, but this provider\'s amount field isn\'t mapped yet — verify the amount manually.',
    });
  }

  await UsedReceipt.create({ reference_key: key, reference: ref, bank, amount });

  // Siinqee receipts allow ~5 views total — flag it so a human doesn't re-verify the
  // same link out of habit and burn through the remaining views.
  const notice = metered ? 'This receipt type has a limited number of views — avoid re-checking it unnecessarily.' : undefined;

  return res.json({ ok: true, bank, amount: amount ?? null, reference: ref, ...(notice ? { notice } : {}) });
});

export default router;
