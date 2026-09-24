// In dev, Vite proxies /api/* to the Express server (see vite.config.js).
// In production, point this at your deployed backend, e.g. via an env var:
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function verifyReceipt(reference, expectedAmount) {
  const res = await fetch(`${API_BASE}/api/verify-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, expectedAmount }),
  });
  // The backend always returns JSON, even on a 4xx (it puts the reason in `error`).
  return res.json();
}
