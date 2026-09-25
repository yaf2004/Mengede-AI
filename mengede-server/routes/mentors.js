import { Router } from 'express';
import { Booking } from '../models/index.js';
import { MENTOR_PAYMENTS, isConfigured } from '../config/mentorPayments.js';

const router = Router();

// GET /api/mentors/:id/payment — the single source of truth for what a student must pay and
// where. The frontend must never invent or trust its own copy of this for verification.
router.get('/:id/payment', (req, res) => {
  const payment = MENTOR_PAYMENTS[req.params.id];
  if (!payment) return res.status(404).json({ ok: false, error: 'That mentor is not available for paid sessions.' });
  if (!isConfigured(payment)) return res.json({ ok: true, configured: false, name: payment.name, rate: payment.rate, method: payment.method });
  const { name, rate, method, account, holderName } = payment;
  res.json({ ok: true, configured: true, name, rate, method, account, holderName });
});

// GET /api/mentors/:id/slots — which of this mentor's slots are already booked, by anyone.
// No auth needed: it doesn't reveal who booked, just which times are gone.
router.get('/:id/slots', async (req, res) => {
  const taken = await Booking.find({ mentor_id: req.params.id }).distinct('slot');
  res.json({ ok: true, taken });
});

export default router;
