import express from 'express';
import { verify, verifyImage, getVerifyStatus } from '../lib/linksEt.js';
import { normalizeReceipt } from '../lib/receiptParsing.js';

const router = express.Router();

// Thin pass-throughs onto lib/linksEt.js for direct/manual use (testing, admin tools,
// or a future frontend feature) — routes/verifyReceipt.js is what the booking flow
// actually calls, with the duplicate-receipt guard and expected-amount check layered
// on top of this.

router.post('/verify', async (req, res) => {
  try {
    const { url, reference, waitMs, idempotencyKey } = req.body || {};
    const result = await verify({ url, reference, waitMs, idempotencyKey });
    const status = result.processingStatus === 'queued' ? 202 : result.status;
    const body = result.status >= 200 && result.status < 300
      ? { ...result.body, normalized: normalizeReceipt(result.body) }
      : result.body;
    res.status(status).json(body);
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: 'internal_error', message: String(err.message || err) } });
  }
});

// For a `queued` result from POST /verify above — check back on a requestId later.
router.get('/verify/:requestId', async (req, res) => {
  try {
    const result = await getVerifyStatus(req.params.requestId);
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: 'internal_error', message: String(err.message || err) } });
  }
});

router.post('/verify-image', async (req, res) => {
  try {
    const { images, imageBase64 } = req.body || {};
    if (!images && !imageBase64) {
      return res.status(400).json({ ok: false, error: { code: 'invalid_request', message: 'images or imageBase64 required' } });
    }
    const result = await verifyImage({ images, imageBase64 });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: 'internal_error', message: String(err.message || err) } });
  }
});

export default router;
