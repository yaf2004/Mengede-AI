// A random id this browser keeps in localStorage, so its bookings survive a refresh. There's
// no login system, so this is NOT a real identity — it just lets the backend tell "this
// device" apart from every other visitor. Clearing site data creates a new one.
const KEY = 'mengede-device-id';

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
    return id;
  } catch {
    if (!getDeviceId._fallback) getDeviceId._fallback = crypto.randomUUID();
    return getDeviceId._fallback;
  }
}
