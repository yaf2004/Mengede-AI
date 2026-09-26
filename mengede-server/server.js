import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectMongo, isMongoConfigured } from './lib/mongo.js';
import verifyReceiptRouter from './routes/verifyReceipt.js';
import bookingsRouter from './routes/bookings.js';
import mentorsRouter from './routes/mentors.js';
import linksEtRouter from './routes/linksEt.js';
import dataRouter from './routes/data.js';
import assistantRouter from './routes/assistant.js';
import universitiesRouter from './routes/universities.js';
import pathwaysRouter from './routes/pathways.js';
import resourcesRouter from './routes/resources.js';
import interactionsRouter from './routes/interactions.js';
import recommendationsRouter from './routes/recommendations.js';

const app = express();

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
app.use('/api/resources', resourcesRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/mentors', mentorsRouter);
app.use('/api/links', linksEtRouter);
app.use('/api/data', dataRouter);

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    mongoConfigured: isMongoConfigured(),
  })
);

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

app.listen(PORT, () => {
  console.log(`Mengede API listening on http://localhost:${PORT}`);
});
