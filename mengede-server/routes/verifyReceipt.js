import { Router } from 'express';
import { verify, isLinksEtConfigured } from '../lib/linksEt.js';
import { normalizeReceipt } from '../lib/receiptParsing.js';
import { matchAccount, nameMatches } from '../lib/match.js';
import { UsedReceipt, Booking } from '../models/index.js';
import { MENTOR_PAYMENTS, isConfigured } from '../config/mentorPayments.js';
import { requireDeviceId } from '../lib/deviceId.js';

const router = Router();

// Friendly copy for links.et's error codes. See https://links.et/docs/errors.md.
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
// links.et's own docs say not to log it. We only ever store/log a normalized hash key.
const hashKey = (ref) => ref.trim().toLowerCase();
const looksLikeUrl = (value) => /^https?:\/\//i.test(value);
const fail = (res, status, error, extra = {}) => res.status(status).json({ ok: false, error, ...extra });

router.use(requireDeviceId);

// POST /api/verify-receipt   { mentorId, slot, reference }
//
// mentorId+slot (not a client-supplied amount) drive the price and payment account — the
// browser can only pick *which* mentor/slot, never how much is owed or who gets paid for it.
// On success this also creates the Booking, atomically with claiming the receipt: a receipt
// can never end up "used" without a booking existing for it (that was the old bug — the window
// between "payment verified" and the student clicking "confirm" could burn the receipt with
// nothing to show for it if they closed the tab in between).
router.post('/', async (req, res) => {
  const { mentorId, slot, reference } = req.body || {};
  const payment = typeof mentorId === 'string' ? MENTOR_PAYMENTS[mentorId] : undefined;
  const ref = typeof reference === 'string' ? reference.trim() : '';

  if (!payment) return fail(res, 404, 'That mentor is not available for paid sessions.');
  if (typeof slot !== 'string' || !slot.trim() || slot.length > 100) return fail(res, 400, 'Pick a time slot first.');
  if (!ref) return fail(res, 400, 'Paste the receipt link or reference first.');
  if (ref.length < 8) return fail(res, 400, 'That reference looks too short — paste the full link or code.');
  if (!isConfigured(payment)) return fail(res, 503, "Payments for this mentor aren't set up yet.");
  if (!isLinksEtConfigured()) {
    return fail(res, 503, 'Payment verification is not configured on this server (LINKS_ET_API_KEY is missing).');
  }

  const key = hashKey(ref);

  const alreadyUsed = await UsedReceipt.findOne({ reference_key: key });
  if (alreadyUsed) {
    if (alreadyUsed.mentor_id === mentorId && alreadyUsed.slot === slot) {
      // Same student re-submitting the same paste for the same booking (tab closed before
      // confirming, then they came back) — hand back the existing booking instead of erroring.
      const existing = await Booking.findOne({ mentor_id: mentorId, slot });
      if (existing) return res.json({ ok: true, booking: existing, bank: alreadyUsed.bank, amount: alreadyUsed.amount, reference: ref });
    }
    return fail(res, 409, 'This receipt has already been used for another booking.');
  }

  // telebirr accepts a bare reference; every other provider needs the full receipt URL.
  const payload = looksLikeUrl(ref) ? { url: ref } : { reference: ref };

  let result;
  try {
    result = await verify({ ...payload, idempotencyKey: key });
  } catch (err) {
    console.error('links.et verify() threw (network-level failure)', err.message);
    return fail(res, 502, 'Could not reach the verification service right now. Please try again.');
  }

  if (result.processingStatus === 'queued') {
    return res.status(202).json({
      ok: false,
      pending: true,
      error: 'Still checking with the bank — this can take a little longer than usual. Try again in a few seconds.',
    });
  }

  if (result.status < 200 || result.status >= 300) {
    const code = result.body?.error?.code;
    const message = ERROR_MESSAGES[code] || result.body?.error?.message || 'We could not verify that receipt.';
    return res.status(result.status).json({ ok: false, error: message });
  }

  const receipt = normalizeReceipt(result.body);

  if (!receipt.completed) return fail(res, 422, 'That payment did not complete.');
  if (!receipt.amountConfirmed) {
    // A genuine bank confirmation, but we don't have a confirmed amount field mapping for this
    // provider — never wave an unchecked amount through.
    return fail(res, 422, "This receipt's amount can't be confirmed automatically yet. Please contact support.");
  }
  if (receipt.currency && receipt.currency !== 'ETB') return fail(res, 422, 'The payment must be in Ethiopian birr.');
  if (!(receipt.amount >= payment.rate)) {
    return fail(res, 422, `The receipt shows ETB ${receipt.amount.toLocaleString()}, but this session costs ETB ${payment.rate.toLocaleString()}.`);
  }
  if (!receipt.receiverConfirmed) {
    return fail(res, 422, "We can't confirm who this receipt was paid to yet for this bank. Please contact support.");
  }
  const accountMatch = matchAccount(receipt.receiverAccount, payment.account);
  if (accountMatch === 'mismatch' || !nameMatches(receipt.receiverName, payment.holderName)) {
    return fail(res, 422, `That receipt was not paid to ${payment.name}'s account. Use the account shown above.`);
  }

  // Claim the receipt and create the booking together. The unique index on Booking's
  // (mentor_id, slot) is what actually stops two students from winning the same slot even if
  // both requests land at the same instant — this check only stops a *different* receipt from
  // trying to double-book after the fact.
  try {
    await UsedReceipt.create({ reference_key: key, reference: ref, bank: receipt.bank, amount: receipt.amount, mentor_id: mentorId, slot, device_id: req.deviceId });
  } catch (err) {
    if (err?.code === 11000) return fail(res, 409, 'This receipt has already been used for another booking.');
    throw err;
  }

  let booking;
  try {
    booking = await Booking.create({ mentor_id: mentorId, slot, device_id: req.deviceId, paid: true, bank: receipt.bank, reference: ref, amount: receipt.amount });
  } catch (err) {
    if (err?.code === 11000) {
      // The slot itself was taken by someone else between our checks above and here. The
      // receipt is already claimed, so refund/support flow is manual for now — surface that
      // clearly rather than silently losing track of it.
      console.error(`[mengede] receipt ${key.slice(0, 8)}… claimed but slot ${mentorId}/${slot} was already booked — needs manual follow-up`);
      return fail(res, 409, 'That time slot was just booked by someone else. Your payment was recorded — contact support to pick a new time.');
    }
    throw err;
  }

  const notice = receipt.metered ? 'This receipt type has a limited number of views — avoid re-checking it unnecessarily.' : undefined;
  return res.json({ ok: true, booking, bank: receipt.bank, amount: receipt.amount, reference: ref, ...(notice ? { notice } : {}) });
});

export default router;
