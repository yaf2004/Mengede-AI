import express from 'express';
import { Recommendation } from '../models/intelligence.js';
import { buildUserContext } from '../services/context.js';
import { listUniversities, listPathways, listUniversityPrograms } from '../services/catalog.js';
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
    signalText
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

function reasonFor(score, explored = false, pathwayConnection = false) {
  if (explored) {
    return 'You have already explored this option, so Mengede is keeping it prominent while you investigate further.';
  }

  if (pathwayConnection) {
    return 'This university is connected to pathways you have already explored.';
  }

  return score > 0
    ? 'Matches signals currently associated with your profile.'
    : 'Worth exploring alongside your current academic and personal signals.';
}

router.get('/', async (req, res) => {
  try {
    const context = await buildUserContext(req.deviceId);
    const tokens = profileTokens(context);

    const intelligence = context.intelligence || {};
    const exploredPathways = new Set(
      intelligence.explored_pathways || []
    );
    const exploredUniversities = new Set(
      intelligence.explored_universities || []
    );

    const [pathways, universities, programs] = await Promise.all([
      listPathways(),
      listUniversities(),
      listUniversityPrograms({ level: 'undergraduate' })
    ]);

    const signalStrength = new Map(
      (intelligence.signals || []).map(signal => [
        signal.key,
        Number(signal.strength) || 0
      ])
    );

    const pathwayUniversities = new Map();
    const universityPathways = new Map();

    for (const program of programs) {
      if (!pathwayUniversities.has(program.pathway_slug)) {
        pathwayUniversities.set(program.pathway_slug, new Set());
      }
      pathwayUniversities.get(program.pathway_slug).add(program.university_slug);

      if (!universityPathways.has(program.university_slug)) {
        universityPathways.set(program.university_slug, new Set());
      }
      universityPathways.get(program.university_slug).add(program.pathway_slug);
    }

    const rankedPathways = pathways
      .map(pathway => {
        const explored = exploredPathways.has(pathway.slug);

        const signalBoost = signalStrength.get(`pathway_interest:${pathway.slug}`) || 0;
        const explorationBoost = signalStrength.get(`pathway_explore:${pathway.slug}`) || 0;
        const roadmapBoost = [...signalStrength.entries()]
          .filter(([key]) => key.startsWith('roadmap_progress:') && key.includes(pathway.slug))
          .reduce((sum, [, strength]) => sum + strength, 0);

        const matchScore =
          scoreEntity(
            pathway,
            tokens,
            ['name', 'description', 'fields', 'skills', 'subjects', 'careers']
          ) +
          signalBoost * 5 +
          explorationBoost * 2 +
          roadmapBoost * 2 +
          (explored ? 5 : 0);

        return {
          ...pathway,
          matchScore,
          reason: reasonFor(matchScore, explored)
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);

    const exploredPathwayUniversities = new Set(
      pathways.flatMap(pathway =>
        exploredPathways.has(pathway.slug)
          ? [...(pathwayUniversities.get(pathway.slug) || [])]
          : []
      )
    );

    const rankedUniversities = universities
      .map(university => {
        const explored = exploredUniversities.has(university.slug);
        const pathwayConnection =
          exploredPathwayUniversities.has(university.slug);

        const universitySignalBoost =
          signalStrength.get(`university_interest:${university.slug}`) || 0;
        const universityExploreBoost =
          signalStrength.get(`university_explore:${university.slug}`) || 0;
        const connectedPathwayBoost = [...(universityPathways.get(university.slug) || [])]
          .reduce(
            (sum, pathwaySlug) =>
              sum +
              (signalStrength.get(`pathway_interest:${pathwaySlug}`) || 0) * 2,
            0
          );

        const matchScore =
          scoreEntity(
            university,
            tokens,
            ['name', 'city', 'region', 'departments', 'tags']
          ) +
          universitySignalBoost * 5 +
          universityExploreBoost * 2 +
          connectedPathwayBoost +
          (pathwayConnection ? 3 : 0) +
          (explored ? 4 : 0);

        return {
          ...university,
          matchScore,
          reason: reasonFor(
            matchScore,
            explored,
            pathwayConnection
          )
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);

    await Recommendation.deleteMany({
      user_id: req.deviceId,
      status: 'active'
    });

    const recommendations = [
      ...rankedPathways.map(pathway => ({
        user_id: req.deviceId,
        entity_type: 'pathway',
        entity_id: pathway.slug,
        reason: pathway.reason,
        confidence: Math.min(pathway.matchScore / 5, 1),
        status: 'active',
        source: 'profile-and-interactions'
      })),

      ...rankedUniversities.map(university => ({
        user_id: req.deviceId,
        entity_type: 'university',
        entity_id: university.slug,
        reason: university.reason,
        confidence: Math.min(university.matchScore / 5, 1),
        status: 'active',
        source: 'profile-and-interactions'
      }))
    ];

    if (recommendations.length) {
      await Recommendation.insertMany(recommendations);
    }

    res.json({
      ok: true,
      pathways: rankedPathways,
      universities: rankedUniversities
    });
  } catch (error) {
    console.error('Recommendation error:', error);

    res.status(500).json({
      ok: false,
      error: error.message || 'Could not build recommendations.'
    });
  }
});

export default router;