const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'i',
  'me',
  'my',
  'we',
  'you',
  'what',
  'how',
  'do',
  'does',
  'can',
  'should'
]);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return normalize(text)
    .split(' ')
    .filter((token) => token && !STOP_WORDS.has(token));
}

function overlapScore(query, values = []) {
  const queryTokens = new Set(tokens(query));

  if (!queryTokens.size) {
    return 0;
  }

  const valueTokens = new Set(
    values.flatMap((value) => tokens(value))
  );

  let score = 0;

  for (const token of queryTokens) {
    if (valueTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

function findPathwayMatches(text, pathways = []) {
  return pathways
    .map((pathway) => ({
      pathway,
      score: overlapScore(text, [
        pathway.name,
        pathway.description,
        ...(pathway.skills || []),
        ...(pathway.subjects || []),
        ...(pathway.careers || [])
      ])
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function findUniversityMatches(text, universities = []) {
  return universities
    .map((university) => ({
      university,
      score: overlapScore(text, [
        university.name,
        university.city,
        ...(university.departments || []),
        ...(university.tags || [])
      ])
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function exploredSet(values = []) {
  return new Set(values.filter(Boolean));
}

export function buildDeterministicResponse({ text, context }) {
  const studentText = String(text || '').trim();
  const pathways = context?.availablePathways || [];
  const universities = context?.availableUniversities || [];
  const intelligence = context?.intelligence || {};

  const exploredPathways = exploredSet(
    intelligence.explored_pathways
  );

  const exploredUniversities = exploredSet(
    intelligence.explored_universities
  );

  const pathwayMatches = findPathwayMatches(
    studentText,
    pathways
  );

  const universityMatches = findUniversityMatches(
    studentText,
    universities
  );

  const recommendations = [];

  for (const item of pathwayMatches.slice(0, 3)) {
    const { pathway, score } = item;

    recommendations.push({
      type: 'pathway',
      id: pathway.slug,
      name: pathway.name,
      reason: exploredPathways.has(pathway.slug)
        ? 'You have already explored this pathway, so Mengede is keeping it available for further investigation.'
        : 'This pathway matches terms from your current question and the pathway information in Mengede.',
      confidence: Math.min(0.95, 0.55 + score * 0.08)
    });
  }

  for (const item of universityMatches.slice(0, 3)) {
    const { university, score } = item;

    recommendations.push({
      type: 'university',
      id: university.slug,
      name: university.name,
      reason: exploredUniversities.has(university.slug)
        ? 'You have already explored this university, so Mengede is keeping it available for continued comparison.'
        : 'This university matches terms from your current question and the university information in Mengede.',
      confidence: Math.min(0.9, 0.5 + score * 0.08)
    });
  }

  let message;

  if (recommendations.length) {
    const pathwayNames = recommendations
      .filter((item) => item.type === 'pathway')
      .map((item) => item.name);

    const universityNames = recommendations
      .filter((item) => item.type === 'university')
      .map((item) => item.name);

    const parts = [];

    if (pathwayNames.length) {
      parts.push(
        `I can help you explore ${pathwayNames.join(', ')} based on what you asked.`
      );
    }

    if (universityNames.length) {
      parts.push(
        `For universities, I can also help you compare ${universityNames.join(', ')}.`
      );
    }

    parts.push(
      'We can use your exploration history and the available information to narrow things down step by step.'
    );

    message = parts.join(' ');
  } else {
    message =
      'I can still help you explore your options using what Mengede already knows about your profile, previous exploration, universities, and pathways. Tell me what you are considering and we can narrow it down step by step.';
  }

  return {
    message,
    intent: 'deterministic_guidance',
    recommendations,
    actions: [],
    sources: [],
    grounded: false,
    provider: 'deterministic'
  };
}