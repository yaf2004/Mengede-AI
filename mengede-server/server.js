import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { connectMongo, isMongoConfigured } from './lib/mongo.js';
import verifyReceiptRouter from './routes/verifyReceipt.js';
import testGeminiRouter from './routes/testGemini.js';
import linksEtRouter from './routes/linksEt.js';
import dataRouter from './routes/data.js';

if (!isMongoConfigured()) {
	console.warn('WARNING: MONGODB_URI is not set. Database-backed routes (/api/data/*, receipt de-dup) will fail until it is.');
} else {
	// Connect eagerly at boot so the first request isn't slowed down waiting on it,
	// and so a bad connection string fails loudly on startup instead of on first use.
	connectMongo().catch((err) => {
		console.error('Failed to connect to MongoDB:', err.message);
	});
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/verify-receipt', verifyReceiptRouter);
app.use('/api/test/gemini', testGeminiRouter);
app.use('/api/links', linksEtRouter);
app.use('/api/data', dataRouter);

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

app.get('/api/health', (_req, res) => res.json({ ok: true, mongoConfigured: isMongoConfigured() }));

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
});
