import { createHash } from 'node:crypto';
import { KnowledgeChunk } from '../models/intelligence.js';

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 250;
const MAX_SEARCH_CORPUS = 5000;

export function splitText(input) {
  const text = String(input || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf('\n', end),
        text.lastIndexOf('. ', end),
        text.lastIndexOf(' ', end)
      );
      if (boundary > start + Math.floor(CHUNK_SIZE * 0.6)) end = boundary + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

async function embedText(text, taskType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required for knowledge embeddings.');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS
      }),
      signal: AbortSignal.timeout(15000)
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Gemini embedding failed (HTTP ${response.status}).`);
  }

  const values = payload?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0 || values.some(value => !Number.isFinite(value))) {
    throw new Error('Gemini returned an invalid embedding vector.');
  }
  return values;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : -1;
}

function chunkId(sourceUrl, title, index) {
  return createHash('sha256').update(`${sourceUrl}\n${title}\n${index}`).digest('hex');
}

export function isRagConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function ingestKnowledgeDocument({
  title,
  sourceUrl,
  sourceType = 'other',
  text,
  language = 'en',
  metadata = {}
}) {
  if (!title?.trim() || !sourceUrl?.trim() || !text?.trim()) {
    throw new Error('title, sourceUrl, and text are required.');
  }
  if (!isRagConfigured()) throw new Error('GEMINI_API_KEY is not configured.');

  const chunks = splitText(text);
  if (!chunks.length) throw new Error('Document contains no indexable text.');
  if (chunks.length > 150) throw new Error('Document is too large; split it into smaller documents.');

  const operations = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const embedding = await embedText(
      `${title.trim()}\n\n${chunks[index]}`,
      'RETRIEVAL_DOCUMENT'
    );
    operations.push({
      updateOne: {
        filter: { chunk_id: chunkId(sourceUrl.trim(), title.trim(), index) },
        update: {
          $set: {
            chunk_id: chunkId(sourceUrl.trim(), title.trim(), index),
            source_url: sourceUrl.trim(),
            source_title: title.trim(),
            source_type: sourceType,
            text: chunks[index],
            chunk_index: index,
            language,
            embedding_model: EMBEDDING_MODEL,
            embedding,
            metadata
          }
        },
        upsert: true
      }
    });
  }

  await KnowledgeChunk.bulkWrite(operations, { ordered: true });
  await KnowledgeChunk.deleteMany({
    source_url: sourceUrl.trim(),
    source_title: title.trim(),
    chunk_index: { $gte: chunks.length }
  });

  return { sourceUrl: sourceUrl.trim(), chunksIndexed: chunks.length, embeddingModel: EMBEDDING_MODEL };
}

export async function searchKnowledge(query, { limit = 5, sourceType } = {}) {
  if (!query?.trim() || !isRagConfigured()) return [];
  const filter = { embedding_model: EMBEDDING_MODEL, embedding: { $exists: true } };
  if (sourceType) filter.source_type = sourceType;
  if (!(await KnowledgeChunk.exists(filter))) return [];
  const queryEmbedding = await embedText(query.trim(), 'RETRIEVAL_QUERY');

  // Suitable for the initial curated corpus. Move to MongoDB Atlas Vector Search
  // once the corpus grows beyond this bounded in-process scan.
  const documents = await KnowledgeChunk.find(filter)
    .select('source_url source_title source_type text chunk_index language embedding metadata')
    .limit(MAX_SEARCH_CORPUS)
    .lean();

  return documents
    .map(document => ({
      title: document.source_title,
      url: document.source_url,
      type: document.source_type,
      text: document.text,
      chunkIndex: document.chunk_index,
      language: document.language,
      metadata: document.metadata || {},
      score: cosineSimilarity(queryEmbedding, document.embedding)
    }))
    .filter(item => item.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(Number(limit) || 5, 1), 8))
    .map(({ embedding, ...item }) => item);
}
