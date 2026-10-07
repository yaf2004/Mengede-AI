import { Conversation, Message } from '../models/index.js';
import { interact } from '../lib/gemini.js';
import { buildUserContext } from './context.js';
import { buildDeterministicResponse } from './reasoningEngine.js';
import {
  getPathway,
  getUniversity,
  ensureCatalog
} from './catalog.js';

const SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    intent: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          id: { type: 'string' },
          name: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'number' }
        },
        required: ['type', 'id', 'name', 'reason', 'confidence']
      }
    },
    actions: {
      type: 'array',
      items: {
        type: 'object'
      }
    }
  },
  required: ['message', 'intent', 'recommendations', 'actions']
};

function buildPrompt(context, studentText) {
  const profile = context.profile || {};
  const intelligence = context.intelligence || {};

  const universities = (context.availableUniversities || [])
    .map(
      (university) =>
        `${university.name} (${university.city})`
    )
    .join(', ');

  const pathways = (context.availablePathways || [])
    .map((pathway) => pathway.name)
    .join(', ');

  const recentMessages = (context.recentMessages || [])
    .map((message) => `${message.role}: ${message.text}`)
    .join('\n');

  return [
    'You are Mengede, a personalized guidance assistant.',
    'Help the student explore education, university, pathway and career choices.',
    'Do not make irreversible decisions for the student. Explain options and help them compare and explore.',
    '',
    'STUDENT PROFILE:',
    JSON.stringify(profile),
    '',
    'USER INTELLIGENCE:',
    JSON.stringify(intelligence),
    '',
    'AVAILABLE UNIVERSITIES:',
    universities,
    '',
    'AVAILABLE PATHWAYS:',
    pathways,
    '',
    'RECENT CONVERSATION:',
    recentMessages || 'No recent conversation.',
    '',
    'CURRENT STUDENT MESSAGE:',
    studentText,
    '',
    'Return structured JSON matching the provided schema.',
    'Recommendations must only use valid university or pathway IDs from the available context.',
    'Give concise reasons for recommendations and avoid pretending uncertain information is verified.'
  ].join('\n');
}

async function runGemini(prompt, fallback) {
  const grounded = await interact({
    input: prompt,
    schema: SCHEMA,
    useSearch: true,
  });

  if (grounded.ok) {
    return {
      ...grounded,
      grounded:
        Array.isArray(grounded.sources) &&
        grounded.sources.length > 0,
    };
  }

  if (grounded.status === 429 || grounded.quota_exceeded) {
    const plain = await interact({
      input: prompt,
      schema: SCHEMA,
      useSearch: false,
    });

    if (plain.ok) {
      return plain;
    }

    return {
      ok: true,
      simulated: true,
      model: 'deterministic',
      output_text: JSON.stringify(fallback),
      sources: [],
      fallback: true,
      grounded: false,
      fallbackReason: 'search_quota_exceeded',
    };
  }

  return {
    ok: true,
    simulated: true,
    model: 'deterministic',
    output_text: JSON.stringify(fallback),
    sources: [],
    fallback: true,
    grounded: false,
  };
}

function normalizeRecommendations(items) {
  return Array.isArray(items)
    ? items.filter(
        (item) =>
          item &&
          (item.type === 'university' ||
            item.type === 'pathway') &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.reason === 'string' &&
          Number.isFinite(Number(item.confidence))
      )
    : [];
}

export async function runAssistant({
  userId,
  conversationId,
  text
}) {
  if (!text?.trim()) {
    throw new Error('Message is required');
  }

  await ensureCatalog();

  let conversation = conversationId
    ? await Conversation.findOne({
        _id: conversationId,
        user_id: userId,
      })
    : null;

  if (!conversation) {
    conversation = await Conversation.create({
      user_id: userId,
      title: text.trim().slice(0, 80),
    });
  }

  await Message.create({
    conversation_id: conversation._id,
    role: 'user',
    text: text.trim(),
  });

  const context = await buildUserContext(
    userId,
    conversation._id
  );

  const prompt = buildPrompt(context, text);

  const deterministic = buildDeterministicResponse({
    text,
    context,
  });

  const result = await runGemini(
    prompt,
    deterministic
  );

  if (!result.ok) {
    throw new Error(
      result.error || 'Gemini request failed'
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(
      String(result.output_text || '{}')
    );
  } catch {
    parsed = null;
  }

  if (!parsed?.message) {
    parsed = {
      message:
        'Tell me more about what you enjoy, what you are good at, or what you are considering.',
      intent: 'general_guidance',
      recommendations: [],
      actions: [],
    };
  }

  const hydrated = [];

  for (const item of normalizeRecommendations(
    parsed.recommendations
  )) {
    if (item.type === 'university') {
      const entity = await getUniversity(item.id);

      if (entity) {
        hydrated.push({
          ...item,
          entity,
        });
      }
    }

    if (item.type === 'pathway') {
      const entity = await getPathway(item.id);

      if (entity) {
        hydrated.push({
          ...item,
          entity,
        });
      }
    }
  }

  const response = {
    ...parsed,
    recommendations: hydrated,
    sources: result.sources || [],
    conversationId: conversation._id.toString(),
    grounded: Boolean(result.grounded),
  };

  await Message.create({
    conversation_id: conversation._id,
    role: 'ai',
    text: parsed.message,
    cards: hydrated,
    sources: result.sources || [],
  });

  conversation.updated_at = new Date();
  await conversation.save();

  return response;
}