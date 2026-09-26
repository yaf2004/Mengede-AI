import express from 'express';
import { Recommendation } from '../models/intelligence.js';
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
      .flatMap(field =>
        Array.isArray(entity[field]) ? entity[field] : [entity[field]]
      )
      .join(' ')
  );

  let score = 0;

  for (const token of candidates) {
    if (tokens.has(token)) score += 1;
  }

  return score;
}

function reasonFor(score) {
  return score > 0
    ? 'Matches signals currently associated with your profile.'
    : 'Worth exploring alongside your current academic and personal signals.';
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
      .map(university => {
        const matchScore = scoreEntity(
          university,
          tokens,
          ['name', 'city', 'region', 'departments', 'tags']
        );

        return {
          ...university,
          matchScore,
          reason: reasonFor(matchScore),
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);

    await Recommendation.deleteMany({
      user_id: req.deviceId,
      status: 'active',
    });

    const recommendations = [
      ...rankedPathways.map(pathway => ({
        user_id: req.deviceId,
        entity_type: 'pathway',
        entity_id: pathway.slug,
        reason: pathway.reason || reasonFor(pathway.matchScore),
        confidence: Math.min(pathway.matchScore / 5, 1),
        status: 'active',
        source: 'profile-and-interactions',
      })),
      ...rankedUniversities.map(university => ({
        user_id: req.deviceId,
        entity_type: 'university',
        entity_id: university.slug,
        reason: university.reason,
        confidence: Math.min(university.matchScore / 5, 1),
        status: 'active',
        source: 'profile-and-interactions',
      })),
    ];

    if (recommendations.length) {
      await Recommendation.insertMany(recommendations);
    }

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
