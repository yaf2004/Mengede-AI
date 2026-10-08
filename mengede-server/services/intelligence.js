import {
  InteractionEvent,
  UserIntelligence
} from '../models/intelligence.js';

const SIGNAL_STRENGTH = {
  RESOURCE_VIEWED: 0.25,
  RESOURCE_SAVED: 0.7,
  RESOURCE_COMPLETED: 0.85,
  PATHWAY_ACCEPTED: 0.7,
  UNIVERSITY_SAVED: 0.7,
  UNIVERSITY_EXPLORED: 0.25,
  PATHWAY_EXPLORED: 0.25,
  RESOURCE_OPENED: 0.15,
  ROADMAP_CREATED: 0.35,
  ROADMAP_TASK_COMPLETED: 0.6
};

const SIGNAL_PREFIX = {
  RESOURCE_VIEWED: 'resource_view:',
  RESOURCE_SAVED: 'resource_interest:',
  RESOURCE_COMPLETED: 'resource_completion:',
  PATHWAY_ACCEPTED: 'pathway_interest:',
  UNIVERSITY_SAVED: 'university_interest:',
  UNIVERSITY_EXPLORED: 'university_explore:',
  PATHWAY_EXPLORED: 'pathway_explore:',
  RESOURCE_OPENED: 'resource_open:',
  ROADMAP_CREATED: 'roadmap_created:',
  ROADMAP_TASK_COMPLETED: 'roadmap_progress:'
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function signalKey(type, entityId) {
  const prefix = SIGNAL_PREFIX[type];
  if (!prefix || !entityId) return null;
  return `${prefix}${entityId}`;
}

function buildEvidence(type, metadata = {}) {
  return {
    type: 'interaction',
    source: type,
    created_at: new Date(),
    metadata
  };
}

async function updateSignal({
  userId,
  key,
  type,
  metadata
}) {
  if (!key) return;

  const baseStrength = SIGNAL_STRENGTH[type] || 0.25;
  const existing = await UserIntelligence.findOne({
    user_id: userId
  }).lean();

  const signals = Array.isArray(existing?.signals) ? existing.signals : [];

  if (existing && !Array.isArray(existing.signals)) {
    await UserIntelligence.updateOne(
      { user_id: userId },
      { $set: { signals: [] } }
    );
  }

  const current = signals.find((signal) => signal.key === key);

  if (!current) {
    await UserIntelligence.findOneAndUpdate(
      { user_id: userId },
      {
        $push: {
          signals: {
            key,
            value: true,
            strength: baseStrength,
            evidence: [buildEvidence(type, metadata)]
          }
        }
      },
      {
        upsert: true
      }
    );

    return;
  }

  const nextStrength = clamp(
    Math.max(
      Number(current.strength) || 0,
      (Number(current.strength) || 0) + baseStrength * 0.15
    )
  );

  await UserIntelligence.updateOne(
    {
      user_id: userId,
      'signals.key': key
    },
    {
      $set: {
        'signals.$.value': true,
        'signals.$.strength': nextStrength
      },
      $push: {
        'signals.$.evidence': buildEvidence(type, metadata)
      }
    }
  );
}

export async function recordInteraction({
  userId,
  type,
  entityType,
  entityId,
  metadata = {}
}) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const event = await InteractionEvent.create({
    user_id: userId,
    type,
    entity_type: entityType,
    entity_id: entityId,
    metadata
  });

  const add = {};

  if (entityType === 'university' && entityId) {
    add.explored_universities = entityId;
  }

  if (entityType === 'pathway' && entityId) {
    add.explored_pathways = entityId;
  }

  if (type === 'RESOURCE_SAVED' && entityId) {
    add.saved_resources = entityId;
  }

  if (type === 'RESOURCE_DISMISSED' && entityId) {
    add.rejected_resources = entityId;
  }

  await UserIntelligence.findOneAndUpdate(
    { user_id: userId },
    {
      $setOnInsert: {
        user_id: userId
      },
      $addToSet: add
    },
    {
      upsert: true,
      new: true
    }
  );

  const key = signalKey(type, entityId);

  await updateSignal({
    userId,
    key,
    type,
    metadata
  });

  return event;
}

export async function getUserIntelligence(userId) {
  return UserIntelligence.findOne({
    user_id: userId
  }).lean();
}