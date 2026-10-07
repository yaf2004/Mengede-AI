import express from 'express';

import {
  listUniversities,
  getUniversity,
  listUniversityPrograms
} from '../services/catalog.js';

const r = express.Router();

r.get('/', async (_, res) => {
  try {
    res.json({
      ok: true,
      universities: await listUniversities()
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

r.get('/:slug', async (req, res) => {
  try {
    const university = await getUniversity(req.params.slug);

    if (!university) {
      return res.status(404).json({
        ok: false,
        error: 'University not found.'
      });
    }

    const programs = await listUniversityPrograms({
      universitySlug: req.params.slug,
      level: 'undergraduate'
    });

    res.json({
      ok: true,
      university,
      programs
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

export default r;