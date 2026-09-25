import express from 'express';
import { interact } from '../lib/gemini.js';
import { incrementAiUsage } from '../models/index.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const text = req.body?.text || 'Hello from Mengede';
  const userId = req.body?.userId;
  try {
    const out = await interact({ input: text });
    // Only count real (non-simulated) calls against the daily usage counter.
    if (out.ok && !out.simulated) {
      try {
        out.usageToday = await incrementAiUsage(userId);
      } catch (usageErr) {
        console.error('ai_usage tracking failed (non-fatal)', usageErr);
      }
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
