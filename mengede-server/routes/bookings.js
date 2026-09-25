import { Router } from 'express';
import { Booking } from '../models/index.js';
import { MENTOR_PAYMENTS, FREE_MENTORS } from '../config/mentorPayments.js';
import { requireDeviceId } from '../lib/deviceId.js';

const router = Router();
router.use(requireDeviceId);
const fail = (res, status, error) => res.status(status).json({ ok: false, error });

router.get('/', async (req, res) => {
  const bookings = await Booking.find({ device_id: req.deviceId }).sort({ created_at: 1 });
  res.json({ ok: true, bookings });
});

// POST /api/bookings   { mentorId, slot }  — free sessions only. Paid sessions go through
// /api/verify-receipt, so a payment can never be skipped for a mentor who charges.
router.post('/', async (req, res) => {
  const { mentorId, slot } = req.body || {};
  if (typeof mentorId !== 'string' || !FREE_MENTORS.has(mentorId)) {
    return fail(res, MENTOR_PAYMENTS[mentorId] ? 402 : 404,
      MENTOR_PAYMENTS[mentorId] ? 'This mentor requires payment; use the payment flow.' : 'That mentor is not available for booking.');
  }
  if (typeof slot !== 'string' || !slot.trim() || slot.length > 100) return fail(res, 400, 'Pick a time slot first.');

  try {
    const booking = await Booking.create({ mentor_id: mentorId, slot, device_id: req.deviceId, paid: false });
    res.json({ ok: true, booking });
  } catch (err) {
    if (err?.code === 11000) return fail(res, 409, 'That time slot was just booked by someone else. Pick another one.');
    throw err;
  }
});

router.delete('/', async (req, res) => {
  await Booking.deleteMany({ device_id: req.deviceId });
  res.json({ ok: true });
});

export default router;
