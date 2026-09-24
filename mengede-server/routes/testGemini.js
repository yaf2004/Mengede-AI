import express from 'express';
import { interact } from '../lib/gemini.js';
const router = express.Router();

router.post('/', async (req, res) => {
  const text = req.body?.text || 'Hello from Mengede';
  try {
    const out = await interact({ input: text });
    res.json(out);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
