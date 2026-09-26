import express from 'express';
import {
  StudentProfile,
  Conversation,
  Message,
  QuizResult,
  StudyPlan,
  PlanTask,
} from '../models/index.js';
import { requireDeviceId } from '../lib/deviceId.js';

const router = express.Router();
router.use(requireDeviceId);

function ownsUser(req, userId) {
  return typeof userId === 'string' && userId === req.deviceId;
}

async function ownsConversation(req, conversationId) {
  return Conversation.findOne({
    _id: conversationId,
    user_id: req.deviceId,
  });
}

async function ownsPlan(req, planId) {
  return StudyPlan.findOne({
    _id: planId,
    user_id: req.deviceId,
  });
}

async function ownsTask(req, taskId) {
  return PlanTask.findOne({
    _id: taskId,
    user_id: req.deviceId,
  });
}

// ---- Student profile -------------------------------------------------------

router.get('/profile/:userId', async (req, res) => {
  if (!ownsUser(req, req.params.userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only access your own profile.',
    });
  }

  const profile = await StudentProfile.findOne({ user_id: req.deviceId });
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: 'No profile for this user yet.',
    });
  }

  res.json({ ok: true, profile });
});

router.put('/profile/:userId', async (req, res) => {
  if (!ownsUser(req, req.params.userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only update your own profile.',
    });
  }

  const {
    name,
    stage,
    grade,
    subjects,
    interests,
    strengths,
    goal,
    language,
  } = req.body || {};

  if (!stage) {
    return res.status(400).json({
      ok: false,
      error: 'stage is required.',
    });
  }

  const profile = await StudentProfile.findOneAndUpdate(
    { user_id: req.deviceId },
    {
      $set: {
        name,
        stage,
        grade,
        subjects,
        interests,
        strengths,
        goal,
        language,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ ok: true, profile });
});

// ---- Conversations & messages ----------------------------------------------

router.get('/conversations/:userId', async (req, res) => {
  if (!ownsUser(req, req.params.userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only access your own conversations.',
    });
  }

  const conversations = await Conversation.find({
    user_id: req.deviceId,
  }).sort({ updated_at: -1 });

  res.json({ ok: true, conversations });
});

router.post('/conversations', async (req, res) => {
  const { userId, title } = req.body || {};

  if (!ownsUser(req, userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only create conversations for yourself.',
    });
  }

  const conversation = await Conversation.create({
    user_id: req.deviceId,
    title,
  });

  res.status(201).json({ ok: true, conversation });
});

router.get('/conversations/:conversationId/messages', async (req, res) => {
  const conversation = await ownsConversation(
    req,
    req.params.conversationId
  );

  if (!conversation) {
    return res.status(404).json({
      ok: false,
      error: 'Conversation not found.',
    });
  }

  const messages = await Message.find({
    conversation_id: conversation._id,
  }).sort({ created_at: 1 });

  res.json({ ok: true, messages });
});

router.post('/conversations/:conversationId/messages', async (req, res) => {
  const { role, text, cards, sources } = req.body || {};

  if (!role || !text) {
    return res.status(400).json({
      ok: false,
      error: 'role and text are required.',
    });
  }

  const conversation = await ownsConversation(
    req,
    req.params.conversationId
  );

  if (!conversation) {
    return res.status(404).json({
      ok: false,
      error: 'Conversation not found.',
    });
  }

  const message = await Message.create({
    conversation_id: conversation._id,
    role,
    text,
    cards,
    sources,
  });

  conversation.updated_at = new Date();
  await conversation.save();

  res.status(201).json({ ok: true, message });
});

// ---- Quiz results -----------------------------------------------------------

router.get('/quiz-results/:userId', async (req, res) => {
  if (!ownsUser(req, req.params.userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only access your own quiz results.',
    });
  }

  const results = await QuizResult.find({
    user_id: req.deviceId,
  }).sort({ created_at: -1 });

  res.json({ ok: true, results });
});

router.post('/quiz-results', async (req, res) => {
  const {
    userId,
    conversationId,
    topic,
    score,
    total,
    missedConcepts,
  } = req.body || {};

  if (!ownsUser(req, userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only create quiz results for yourself.',
    });
  }

  if (score == null || total == null) {
    return res.status(400).json({
      ok: false,
      error: 'score and total are required.',
    });
  }

  if (
    conversationId &&
    !(await ownsConversation(req, conversationId))
  ) {
    return res.status(403).json({
      ok: false,
      error: 'Conversation does not belong to this user.',
    });
  }

  const result = await QuizResult.create({
    user_id: req.deviceId,
    conversation_id: conversationId || undefined,
    topic,
    score,
    total,
    missed_concepts: missedConcepts,
  });

  res.status(201).json({ ok: true, result });
});

// ---- Study plans & tasks ----------------------------------------------------

router.get('/study-plans/:userId', async (req, res) => {
  if (!ownsUser(req, req.params.userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only access your own study plans.',
    });
  }

  const plans = await StudyPlan.find({
    user_id: req.deviceId,
  }).sort({ created_at: -1 });

  res.json({ ok: true, plans });
});

router.post('/study-plans', async (req, res) => {
  const { userId, title, weeks, startDate } = req.body || {};

  if (!ownsUser(req, userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only create study plans for yourself.',
    });
  }

  if (!title) {
    return res.status(400).json({
      ok: false,
      error: 'title is required.',
    });
  }

  const plan = await StudyPlan.create({
    user_id: req.deviceId,
    title,
    weeks,
    start_date: startDate,
  });

  res.status(201).json({ ok: true, plan });
});

router.get('/study-plans/:planId/tasks', async (req, res) => {
  const plan = await ownsPlan(req, req.params.planId);

  if (!plan) {
    return res.status(404).json({
      ok: false,
      error: 'Study plan not found.',
    });
  }

  const tasks = await PlanTask.find({
    plan_id: plan._id,
    user_id: req.deviceId,
  });

  res.json({ ok: true, tasks });
});

router.post('/study-plans/:planId/tasks', async (req, res) => {
  const { userId, weekLabel, text } = req.body || {};

  if (!ownsUser(req, userId)) {
    return res.status(403).json({
      ok: false,
      error: 'You can only create tasks for yourself.',
    });
  }

  if (!text) {
    return res.status(400).json({
      ok: false,
      error: 'text is required.',
    });
  }

  const plan = await ownsPlan(req, req.params.planId);

  if (!plan) {
    return res.status(404).json({
      ok: false,
      error: 'Study plan not found.',
    });
  }

  const task = await PlanTask.create({
    plan_id: plan._id,
    user_id: req.deviceId,
    week_label: weekLabel,
    text,
  });

  res.status(201).json({ ok: true, task });
});

router.patch('/study-plans/tasks/:taskId', async (req, res) => {
  const task = await ownsTask(req, req.params.taskId);

  if (!task) {
    return res.status(404).json({
      ok: false,
      error: 'Task not found.',
    });
  }

  const { done } = req.body || {};
  task.done = Boolean(done);
  task.done_at = done ? new Date() : null;
  await task.save();

  res.json({ ok: true, task });
});

export default router;
