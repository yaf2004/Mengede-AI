import express from 'express';
import { verify, verifyImage } from '../lib/linksEt.js';

const router = express.Router();

router.post('/verify', async (req, res) => {
  try {
    const { url, reference, waitMs, idempotencyKey } = req.body || {};
    const out = await verify({ url, reference, waitMs, idempotencyKey });
    res.status(out.status).json(out.body);
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: 'internal_error', message: String(err) } });
  }
});

router.post('/verify-image', async (req, res) => {
  try {
    const images = req.body?.images || (req.body?.imageBase64 ? [{ imageBase64: req.body.imageBase64 }] : undefined);
    if (!images) return res.status(400).json({ ok: false, error: { code: 'invalid_request', message: 'images required' } });
    const out = await verifyImage({ images });
    res.status(out.status).json(out.body);
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: 'internal_error', message: String(err) } });
  }
});

export default router;
