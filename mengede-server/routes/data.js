import express from 'express';
import { StudentProfile, Conversation, Message, QuizResult, StudyPlan, PlanTask } from '../models/index.js';

const router = express.Router();

// ---- Student profile -------------------------------------------------------

router.get('/profile/:userId', async (req, res) => {
  if (req.header('x-device-id') !== req.params.userId) {
    return res.status(403).json({ ok: false, error: 'You can only access your own profile.' });
  }

  const profile = await StudentProfile.findOne({ user_id: req.params.userId });
  if (!profile) return res.status(404).json({ ok: false, error: 'No profile for this user yet.' });
  res.json({ ok: true, profile });
});

router.put('/profile/:userId', async (req, res) => {
  if (req.header('x-device-id') !== req.params.userId) {
    return res.status(403).json({ ok: false, error: 'You can only update your own profile.' });
  }

  const { stage, grade, subjects, interests, strengths, goal, language } = req.body || {};
  if (!stage) return res.status(400).json({ ok: false, error: '`stage` is required.' });

  const profile = await StudentProfile.findOneAndUpdate(
    { user_id: req.params.userId },
    { $set: { stage, grade, subjects, interests, strengths, goal, language } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ ok: true, profile });
});

// ---- Conversations & messages ----------------------------------------------

router.get('/conversations/:userId', async (req, res) => {
  const conversations = await Conversation.find({ user_id: req.params.userId }).sort({ updated_at: -1 });
  res.json({ ok: true, conversations });
});

router.post('/conversations', async (req, res) => {
  const { userId, title } = req.body || {};
  if (!userId) return res.status(400).json({ ok: false, error: '`userId` is required.' });
  const conversation = await Conversation.create({ user_id: userId, title });
  res.status(201).json({ ok: true, conversation });
});

router.get('/conversations/:conversationId/messages', async (req, res) => {
  const messages = await Message.find({ conversation_id: req.params.conversationId }).sort({ created_at: 1 });
  res.json({ ok: true, messages });
});

router.post('/conversations/:conversationId/messages', async (req, res) => {
  const { role, text, cards, sources } = req.body || {};
  if (!role || !text) return res.status(400).json({ ok: false, error: '`role` and `text` are required.' });

  const conversation = await Conversation.findById(req.params.conversationId);
  if (!conversation) return res.status(404).json({ ok: false, error: 'Conversation not found.' });

  const message = await Message.create({ conversation_id: conversation._id, role, text, cards, sources });
  conversation.updated_at = new Date();
  await conversation.save();

  res.status(201).json({ ok: true, message });
});

// ---- Quiz results -----------------------------------------------------------

router.get('/quiz-results/:userId', async (req, res) => {
  const results = await QuizResult.find({ user_id: req.params.userId }).sort({ created_at: -1 });
  res.json({ ok: true, results });
});

router.post('/quiz-results', async (req, res) => {
  const { userId, conversationId, topic, score, total, missedConcepts } = req.body || {};
  if (!userId || score == null || total == null) {
    return res.status(400).json({ ok: false, error: '`userId`, `score`, and `total` are required.' });
  }
  const result = await QuizResult.create({
    user_id: userId,
    conversation_id: conversationId || undefined,
    topic,
    score,
    total,
    missed_concepts: missedConcepts,
  });
  res.status(201).json({ ok: true, result });
});

// ---- Study plans & tasks ------------------------------------------------------

router.get('/study-plans/:userId', async (req, res) => {
  const plans = await StudyPlan.find({ user_id: req.params.userId }).sort({ created_at: -1 });
  res.json({ ok: true, plans });
});

router.post('/study-plans', async (req, res) => {
  const { userId, title, weeks, startDate } = req.body || {};
  if (!userId || !title) return res.status(400).json({ ok: false, error: '`userId` and `title` are required.' });
  const plan = await StudyPlan.create({ user_id: userId, title, weeks, start_date: startDate });
  res.status(201).json({ ok: true, plan });
});

router.get('/study-plans/:planId/tasks', async (req, res) => {
  const tasks = await PlanTask.find({ plan_id: req.params.planId });
  res.json({ ok: true, tasks });
});

router.post('/study-plans/:planId/tasks', async (req, res) => {
  const { userId, weekLabel, text } = req.body || {};
  if (!userId || !text) return res.status(400).json({ ok: false, error: '`userId` and `text` are required.' });
  const task = await PlanTask.create({ plan_id: req.params.planId, user_id: userId, week_label: weekLabel, text });
  res.status(201).json({ ok: true, task });
});

router.patch('/study-plans/tasks/:taskId', async (req, res) => {
  const { done } = req.body || {};
  const task = await PlanTask.findByIdAndUpdate(
    req.params.taskId,
    { done: Boolean(done), done_at: done ? new Date() : null },
    { new: true }
  );
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found.' });
  res.json({ ok: true, task });
});

export default router;
