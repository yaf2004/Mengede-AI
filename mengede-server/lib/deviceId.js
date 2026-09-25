// There's no real login system yet, so bookings are scoped to a random id the frontend
// generates once and stores in localStorage (see mengede-web/src/lib/device.js). This is enough
// to survive a page refresh; it is NOT authentication — anyone who guesses or steals the id can
// read that "device"'s bookings. Don't put anything sensitive behind it.
const ID_RE = /^[A-Za-z0-9_-]{16,80}$/;

export function requireDeviceId(req, res, next) {
  const id = req.get('x-device-id');
  if (!id || !ID_RE.test(id)) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid X-Device-Id header.' });
  }
  req.deviceId = id;
  next();
}
