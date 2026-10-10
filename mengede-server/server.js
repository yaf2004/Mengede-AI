import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { connectMongo, isMongoConfigured } from './lib/mongo.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import verifyReceiptRouter from './routes/verifyReceipt.js';
import bookingsRouter from './routes/bookings.js';
import mentorsRouter from './routes/mentors.js';
import linksEtRouter from './routes/linksEt.js';
import dataRouter from './routes/data.js';
import assistantRouter from './routes/assistant.js';
import universitiesRouter from './routes/universities.js';
import pathwaysRouter from './routes/pathways.js';
import programsRouter from './routes/programs.js';
import resourcesRouter from './routes/resources.js';
import interactionsRouter from './routes/interactions.js';
import recommendationsRouter from './routes/recommendations.js';
import knowledgeRouter from './routes/knowledge.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const assistantLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.ASSISTANT_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      ok: false,
      error: 'Too many assistant requests. Please wait a minute and try again.',
    }),
});

const knowledgeLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.KNOWLEDGE_RATE_LIMIT) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      ok: false,
      error: 'Too many knowledge search requests. Please wait a minute and try again.',
    }),
});

const discoveryLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.DISCOVERY_RATE_LIMIT) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      ok: false,
      error: 'Too many resource discovery requests. Please wait a minute and try again.',
    }),
});

app.use(
  '/api/verify-receipt',
  rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.VERIFY_RATE_LIMIT) || 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        ok: false,
        error: 'Too many attempts. Wait a minute and try again.',
      }),
  }),
  verifyReceiptRouter
);

app.use('/api/assistant', assistantLimiter, assistantRouter);
app.use('/api/resources/discover', discoveryLimiter);
app.use('/api/universities', universitiesRouter);
app.use('/api/pathways', pathwaysRouter);
app.use('/api/programs', programsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/knowledge', knowledgeLimiter, knowledgeRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/mentors', mentorsRouter);
app.use('/api/links', linksEtRouter);
app.use('/api/data', dataRouter);

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    mongoConfigured: isMongoConfigured(),
    mongoConnected: mongoose.connection.readyState === 1,
  })
);

// Render readiness check: do not report healthy until MongoDB is connected.
app.get('/api/health/ready', (_req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  const ready = isMongoConfigured() && mongoConnected;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    mongoConfigured: isMongoConfigured(),
    mongoConnected,
  });
});

// In production, serve the built React app from this same origin as the API.
if (process.env.NODE_ENV === 'production') {
  const webDist = path.resolve(__dirname, '../mengede-web/dist');
  app.use(express.static(webDist));
  app.get('/{*path}', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Route not found.',
  });
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({
    ok: false,
    error: 'Internal server error.',
  });
});

if (!isMongoConfigured()) {
  console.warn(
    'WARNING: MONGODB_URI is not set. Database-backed routes will fail until it is.'
  );
} else {
  connectMongo().catch(error =>
    console.error('Failed to connect to MongoDB:', error.message)
  );
}

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mengede API listening on port ${PORT}`);
});
