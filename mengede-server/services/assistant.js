import { Conversation, Message } from '../models/index.js';
import { interact } from '../lib/gemini.js';
import { buildUserContext } from './context.js';
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
          confidence: { type: 'number' },
        },
        required: ['type', 'id', 'name', 'reason', 'confidence'],
      },
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          id: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['type', 'id', 'label'],
      },
    },
  },
  required: ['message', 'intent', 'recommendations', 'actions'],
};

function buildPrompt(context, studentText) {
  return [
    'You are Mengede, an Ethiopian student decision-exploration assistant.',
    'Do not choose a future for the student.',
    'Help them investigate options and make an informed decision.',
    'Use the supplied context and catalog.',
    'For current facts or external resources, use Google Search grounding when available.',
    'Never invent universities, departments, videos, courses, locations, admission rules or statistics.',
    'If external search is unavailable, answer using only the supplied context and clearly avoid claiming that current external facts were verified.',
    'Only recommend universities and pathways whose exact slugs appear in the supplied catalog.',
    'Return only JSON matching the supplied schema.',
    '',
    'CONTEXT:',
    JSON.stringify(context),
    '',
    'STUDENT:',
    studentText.trim(),
  ].join('\n');
}

async function runGemini(prompt) {
  const grounded = await interact({
    input: prompt,
    schema: SCHEMA,
    useSearch: true,
  });

  if (grounded.ok) {
    return {
      ...grounded,
      grounded: true,
    };
  }

  if (grounded.status === 429 || grounded.quota_exceeded) {
    const fallback = await interact({
      input: prompt,
      schema: SCHEMA,
      useSearch: false,
    });

    return {
      ...fallback,
      grounded: false,
      fallbackReason: 'search_quota_exceeded',
    };
  }

  return {
    ...grounded,
    grounded: false,
  };
}

function normalizeRecommendations(items) {
  return Array.isArray(items)
    ? items.filter(item =>
        item &&
        (item.type === 'university' || item.type === 'pathway') &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.reason === 'string' &&
        Number.isFinite(Number(item.confidence))
      )
    : [];
}

export async function runAssistant({ userId, conversationId, text }) {
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

  const context = await buildUserContext(userId, conversation._id);
  const prompt = buildPrompt(context, text);
  const result = await runGemini(prompt);

  if (!result.ok) {
    throw new Error(result.error || 'Gemini request failed');
  }

  let parsed;

  try {
    parsed = JSON.parse(String(result.output_text || '{}'));
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

  for (const item of normalizeRecommendations(parsed.recommendations)) {
    if (item.type === 'university') {
      const entity = await getUniversity(item.id);

      if (entity) {
        hydrated.push({ ...item, entity });
      }
    }

    if (item.type === 'pathway') {
      const entity = await getPathway(item.id);

      if (entity) {
        hydrated.push({ ...item, entity });
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
