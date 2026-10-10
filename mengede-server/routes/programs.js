import express from 'express';

import {
  listUniversityPrograms,
  getUniversityProgram
} from '../services/catalog.js';

const r = express.Router();

r.get('/', async (req, res) => {
  try {
    const programs = await listUniversityPrograms({
      universitySlug: req.query.university,
      pathwaySlug: req.query.pathway,
      level: req.query.level
    });

    res.json({
      ok: true,
      programs
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

r.get('/:university/:pathway', async (req, res) => {
  try {
    const program = await getUniversityProgram(
      req.params.university,
      req.params.pathway
    );

    if (!program) {
      return res.status(404).json({
        ok: false,
        error: 'Program relationship not found.'
      });
    }

    res.json({
      ok: true,
      program
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

export default r;