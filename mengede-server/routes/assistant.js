import express from 'express';
import { runAssistant } from '../services/assistant.js';
import { requireDeviceId } from '../lib/deviceId.js';

const router = express.Router();
router.use(requireDeviceId);

router.post('/', async (req, res) => {
  try {
    const { text, conversationId } = req.body || {};

    if (!text?.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'text is required.',
      });
    }

    res.json({
      ok: true,
      ...(await runAssistant({
        userId: req.deviceId,
        conversationId,
        text,
      })),
    });
  } catch (error) {
    console.error('Assistant error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Assistant request failed.',
    });
  }
});

export default router;
