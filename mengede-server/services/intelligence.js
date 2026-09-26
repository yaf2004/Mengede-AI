import { InteractionEvent, UserIntelligence } from '../models/intelligence.js';

const SIGNAL_TYPES = new Map([
  ['UNIVERSITY_SAVED', ['university_interest', 0.7]],
  ['PATHWAY_ACCEPTED', ['pathway_interest', 0.7]],
  ['RESOURCE_COMPLETED', ['resource_completion', 0.85]],
  ['RESOURCE_SAVED', ['resource_interest', 0.7]],
]);

export async function recordInteraction({ userId, type, entityType, entityId, metadata = {} }) {
  if (!userId) throw new Error('userId is required');

  const event = await InteractionEvent.create({
    user_id: userId,
    type,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });

  const add = {};
  if (entityType === 'university' && entityId) add.explored_universities = entityId;
  if (entityType === 'pathway' && entityId) add.explored_pathways = entityId;
  if (type === 'RESOURCE_SAVED' && entityId) add.saved_resources = entityId;
  if (type === 'RESOURCE_DISMISSED' && entityId) add.rejected_resources = entityId;

  const signal = SIGNAL_TYPES.get(type);
  const update = { $setOnInsert: { user_id: userId } };
  if (Object.keys(add).length) update.$addToSet = add;

  if (signal && entityId) {
    const [keyPrefix, strength] = signal;
    update.$push = {
      signals: {
        key: keyPrefix + ':' + entityId,
        value: true,
        strength,
        evidence: [{ type: 'interaction', source: type, created_at: new Date() }],
      },
    };
  }

  await UserIntelligence.findOneAndUpdate(
    { user_id: userId },
    update,
    { upsert: true, new: true }
  );

  return event;
}

export async function getUserIntelligence(userId) {
  return UserIntelligence.findOne({ user_id: userId }).lean();
}
