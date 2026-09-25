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

if (!isMongoConfigured()) {
  console.warn('WARNING: MONGODB_URI is not set. Database-backed routes (/api/data/*, bookings, receipt de-dup) will fail until it is.');
} else {
  // Connect eagerly at boot so the first request isn't slowed down waiting on it, and so a bad
  // connection string fails loudly on startup instead of on first use.
  connectMongo().catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
  });
}

const app = express();
app.use(cors());
app.use(express.json());

// Every payment-verification call can spend the links.et plan's verification quota, so cap
// attempts per client IP.
app.use('/api/verify-receipt', rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.VERIFY_RATE_LIMIT) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ ok: false, error: 'Too many attempts. Wait a minute and try again.' }),
}), verifyReceiptRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/mentors', mentorsRouter);
app.use('/api/links', linksEtRouter);
app.use('/api/data', dataRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, mongoConfigured: isMongoConfigured() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Mengede API listening on http://localhost:${PORT}`));
