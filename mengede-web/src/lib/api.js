// In dev, Vite proxies /api/* to the Express server (see vite.config.js).
// In production, point this at your deployed backend, e.g. via an env var:
import { getDeviceId } from './device.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() },
    body: body ? JSON.stringify(body) : undefined,
  });
  // The backend always returns JSON, even on a 4xx/5xx (the reason is in `error`).
  return res.json().catch(() => ({ ok: false, error: 'Unexpected response from the server.' }));
}

// mentorId/slot (not a client-supplied amount) drive the price on the server — see
// mengede-server/config/mentorPayments.js.
export const verifyReceipt = (mentorId, slot, reference) =>
  call('/api/verify-receipt', { method: 'POST', body: { mentorId, slot, reference } });

export const createBooking = (mentorId, slot) =>
  call('/api/bookings', { method: 'POST', body: { mentorId, slot } });

export const listBookings = () => call('/api/bookings');
export const clearBookings = () => call('/api/bookings', { method: 'DELETE' });

export const getMentorPayment = (mentorId) => call(`/api/mentors/${mentorId}/payment`);
export const getMentorTakenSlots = (mentorId) => call(`/api/mentors/${mentorId}/slots`);
