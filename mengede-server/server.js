import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import verifyReceiptRouter from './routes/verifyReceipt.js';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { interact } from './lib/gemini.js';

// Database must be configured via DATABASE_URL. We do not run migrations automatically.
if (!process.env.DATABASE_URL) {
	console.warn('WARNING: DATABASE_URL is not set. Database features are disabled.');
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/verify-receipt', verifyReceiptRouter);
import testGeminiRouter from './routes/testGemini.js';
app.use('/api/test/gemini', testGeminiRouter);

// --- Mock Voxide SDK endpoints for local dev ---------------------------------
app.get('/api/sdk/init', (_req, res) => {
	// Minimal init response the frontend SDK expects
	return res.json({
		ok: true,
		config: {
			agent: { language: 'en-US' },
			appearance: {},
		},
	});
});

app.post('/api/sdk/manifest', (req, res) => {
	// Accept manifest sync requests; respond 200 so the SDK proceeds.
	return res.json({ ok: true });
});

// Lightweight WebSocket upgrade handling for /api/sdk/live
const server = app.listen; // placeholder to satisfy linter

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
const httpServer = app.listen(PORT, () => {
	console.log(`Mengede API listening on http://localhost:${PORT}`);

	// Attach a simple WebSocket server on the same HTTP server for /api/sdk/live
	const wss = new WebSocketServer({ server: httpServer, path: '/api/sdk/live' });
	wss.on('connection', (ws) => {
		// Send a ready message and echo text messages back as 'text' events
		ws.send(JSON.stringify({ type: 'ready', sessionId: 'local-session' }));
		ws.on('message', (msg) => {
			// For local testing, just echo incoming messages as text events
			try {
				const parsed = JSON.parse(msg.toString());
				if (parsed.type === 'input') {
					ws.send(JSON.stringify({ type: 'text', text: `Echo: ${parsed.text || ''}` }));
				}
			} catch {
				ws.send(JSON.stringify({ type: 'text', text: `Echo (raw): ${msg.toString()}` }));
			}
		});
	});

	// Simple test route to exercise Gemini client (returns simulated if GEMINI_API_KEY missing)
	app.post('/api/test/gemini', async (req, res) => {
		const text = req.body?.text || 'Hello from Mengede';
		try {
			const out = await interact({ input: text });
			return res.json(out);
		} catch (err) {
			console.error('Gemini test error', err);
			return res.status(500).json({ ok: false, error: String(err) });
		}
	});
});
