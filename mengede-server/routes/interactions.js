import express from 'express';
import {
  recordInteraction,
  getUserIntelligence,
} from '../services/intelligence.js';
import { requireDeviceId } from '../lib/deviceId.js';

const router = express.Router();
router.use(requireDeviceId);

router.post('/', async (req, res) => {
  try {
    const { type, entityType, entityId, metadata } = req.body || {};

    if (!type) {
      return res.status(400).json({
        ok: false,
        error: 'type is required.',
      });
    }

    res.status(201).json({
      ok: true,
      event: await recordInteraction({
        userId: req.deviceId,
        type,
        entityType,
        entityId,
        metadata,
      }),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Could not record interaction.',
    });
  }
});

router.get('/intelligence', async (req, res) => {
  try {
    res.json({
      ok: true,
      intelligence: await getUserIntelligence(req.deviceId),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Could not load intelligence.',
    });
  }
});

export default router;
