import express from 'express';
import { buildUserContext } from '../services/context.js';
import { listUniversities, listPathways } from '../services/catalog.js';
import { requireDeviceId } from '../lib/deviceId.js';

const router = express.Router();
router.use(requireDeviceId);

function tokenize(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 2)
  );
}

function profileTokens(context) {
  const signalText = (context.intelligence?.signals || [])
    .map(signal => [signal.key, signal.value].join(' '))
    .join(' ');

  return tokenize([
    context.profile?.interests,
    context.profile?.strengths,
    context.profile?.goal,
    signalText,
  ].join(' '));
}

function scoreEntity(entity, tokens, fields) {
  const candidates = tokenize(
    fields
      .flatMap(field => Array.isArray(entity[field]) ? entity[field] : [entity[field]])
      .join(' ')
  );

  let score = 0;
  for (const token of candidates) {
    if (tokens.has(token)) score += 1;
  }

  return score;
}

router.get('/', async (req, res) => {
  try {
    const context = await buildUserContext(req.deviceId);
    const tokens = profileTokens(context);
    const [pathways, universities] = await Promise.all([
      listPathways(),
      listUniversities(),
    ]);

    const rankedPathways = pathways
      .map(pathway => ({
        ...pathway,
        matchScore: scoreEntity(
          pathway,
          tokens,
          ['name', 'description', 'fields', 'skills', 'subjects', 'careers']
        ),
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);

    const rankedUniversities = universities
      .map(university => ({
        ...university,
        matchScore: scoreEntity(
          university,
          tokens,
          ['name', 'city', 'region', 'departments', 'tags']
        ),
        reason:
          scoreEntity(
            university,
            tokens,
            ['name', 'city', 'region', 'departments', 'tags']
          ) > 0
            ? 'Matches signals currently associated with your profile.'
            : 'Worth exploring alongside your current academic and personal signals.',
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);

    res.json({
      ok: true,
      pathways: rankedPathways,
      universities: rankedUniversities,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Could not build recommendations.',
    });
  }
});

export default router;
