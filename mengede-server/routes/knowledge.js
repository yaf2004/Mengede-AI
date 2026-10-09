import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ingestKnowledgeDocument, isRagConfigured, searchKnowledge } from '../services/rag.js';

const router = express.Router();
const ALLOWED_TYPES = new Set([
  'university', 'program', 'legislation', 'published_paper',
  'official_document', 'research', 'other'
]);

function authorized(req) {
  const expected = process.env.KNOWLEDGE_INGEST_KEY;
  const supplied = req.get('x-knowledge-ingest-key') || '';
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

router.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.status(400).json({ ok: false, error: 'q is required.' });
  if (query.length > 1000) return res.status(400).json({ ok: false, error: 'q is too long.' });

  try {
    const results = await searchKnowledge(query, { limit: req.query.limit });
    res.json({
      ok: true,
      configured: isRagConfigured(),
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Knowledge retrieval failed:', error.message);
    res.status(503).json({ ok: false, error: 'Knowledge retrieval is temporarily unavailable.' });
  }
});

router.post('/ingest', async (req, res) => {
  if (!authorized(req)) {
    return res.status(process.env.KNOWLEDGE_INGEST_KEY ? 401 : 503).json({
      ok: false,
      error: process.env.KNOWLEDGE_INGEST_KEY
        ? 'Invalid ingestion credentials.'
        : 'Knowledge ingestion is not configured.'
    });
  }

  const { title, sourceUrl, sourceType = 'other', text, language = 'en', metadata = {} } = req.body || {};
  if (!title || !sourceUrl || !text) {
    return res.status(400).json({ ok: false, error: 'title, sourceUrl, and text are required.' });
  }
  if (!ALLOWED_TYPES.has(sourceType)) {
    return res.status(400).json({ ok: false, error: 'Unsupported sourceType.' });
  }
  if (typeof text !== 'string' || text.length > 250000) {
    return res.status(400).json({ ok: false, error: 'text must be a string of at most 250000 characters.' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return res.status(400).json({ ok: false, error: 'sourceUrl must be a valid HTTP(S) URL.' });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ ok: false, error: 'sourceUrl must use HTTP or HTTPS.' });
  }

  try {
    const result = await ingestKnowledgeDocument({
      title: String(title),
      sourceUrl: parsedUrl.toString(),
      sourceType,
      text,
      language: String(language).slice(0, 16),
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
    });
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    console.error('Knowledge ingestion failed:', error.message);
    res.status(503).json({ ok: false, error: 'Knowledge ingestion failed. Check embedding configuration and retry.' });
  }
});

export default router;
