import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons.jsx';
import { rateLabel } from '../data/mentors.js';
import { verifyReceipt as verifyReceiptApi, createBooking, getMentorPayment, getMentorTakenSlots } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function BookingModal({ mentor, onClose, onConfirm }) {
  const [openSlots, setOpenSlots] = useState(mentor.slots);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [slot, setSlot] = useState(null);
  const [view, setView] = useState('pick'); // 'pick' | 'pay'
  const [pickBusy, setPickBusy] = useState(null); // which slot is being booked, if any
  const [pickError, setPickError] = useState('');
  const [payment, setPayment] = useState(null); // { configured, rate, method, account, holderName }
  const [paymentError, setPaymentError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(null); // { bank, amount, reference, booking }
  const flash = useToast();

  const isPaid = mentor.rate > 0;

  // Slots are a shared calendar — refresh which ones are already taken (by anyone) on open.
  useEffect(() => {
    let live = true;
    getMentorTakenSlots(mentor.id).then(res => {
      if (!live) return;
      const taken = res.ok ? new Set(res.taken) : new Set();
      setOpenSlots(mentor.slots.filter(s => !taken.has(s)));
      setSlotsLoaded(true);
    });
    return () => { live = false; };
  }, [mentor]);

  async function pickSlot(s) {
    if (isPaid) { setSlot(s); setView('pay'); return; }
    setPickBusy(s);
    setPickError('');
    const res = await createBooking(mentor.id, s);
    setPickBusy(null);
    if (!res.ok) {
      if (res.code === 'slot_already_booked') setOpenSlots(list => list.filter(x => x !== s));
      setPickError(res.error || 'Could not book that session. Try again.');
      return;
    }
    onConfirm({ ...res.booking, mentor });
  }

  useEffect(() => {
    if (view !== 'pay') return;
    let live = true;
    getMentorPayment(mentor.id).then(res => {
      if (!live) return;
      if (res.ok) setPayment(res);
      else setPaymentError(res.error || 'Could not load payment details right now.');
    });
    return () => { live = false; };
  }, [view, mentor]);

  async function runVerify() {
    const ref = receipt.trim();
    if (!ref) { setError('Paste the receipt link or reference first.'); return; }
    if (ref.length < 8) { setError('That reference looks too short — paste the full link or code.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await verifyReceiptApi(mentor.id, slot, ref);
      if (result.ok) setVerified(result);
      else setError(result.error || 'Could not verify that receipt. Double-check it and try again.');
    } catch {
      setError('Could not reach the verification service. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  function confirmPaidBooking() {
    // The booking was already created by /api/verify-receipt; this just hands it to the UI.
    onConfirm({ ...verified.booking, mentor });
  }

  function copyAccount() {
    if (!payment?.account) return;
    navigator.clipboard?.writeText(payment.account).then(() => flash('Account number copied'));
  }

  return (
    <div id="bookingModal" className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-lg">{view === 'pick' ? `Book with ${mentor.name}` : 'Pay for your session'}</div>
          <button onClick={onClose} className="glass w-8 h-8 rounded-lg flex items-center justify-center"><Icon name="x" className="w-4 h-4" /></button>
        </div>

        {view === 'pick' && (
          <div className="space-y-2">
            <div className="text-sm text-slate-500 mb-3">Pick a time that works for you.</div>
            {pickError && <div className="text-sm text-rose-600 mb-2">{pickError}</div>}
            {slotsLoaded && openSlots.length === 0 && (
              <div className="text-sm text-slate-500">No open times left — check back soon.</div>
            )}
            {openSlots.map(s => (
              <button key={s} onClick={() => pickSlot(s)} disabled={pickBusy === s} className="pill glass w-full flex items-center gap-2 justify-start text-left" style={{ padding: '10px 16px' }}>
                <Icon name="clock" className="w-4 h-4" /> {pickBusy === s ? 'Booking…' : s}
              </button>
            ))}
          </div>
        )}

        {view === 'pay' && (
          <div>
            <div className="card p-4 mb-4">
              <div className="flex justify-between text-sm mb-1"><span className="text-slate-500">Mentor</span><span className="font-medium">{mentor.name}</span></div>
              <div className="flex justify-between text-sm mb-1"><span className="text-slate-500">Time</span><span className="font-medium">{slot}</span></div>
              <div className="flex justify-between text-sm mb-1"><span className="text-slate-500">Duration</span><span className="font-medium">{mentor.duration} min</span></div>
              <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200">
                <span className="text-slate-500">Amount</span><span className="font-bold">{rateLabel(mentor)}</span>
              </div>
            </div>

            {paymentError && <div className="text-sm text-rose-600 mb-2">{paymentError}</div>}

            {!payment && !paymentError && (
              <div className="text-sm text-slate-500 mb-4">Loading payment details…</div>
            )}

            {payment && !payment.configured && (
              <div className="card p-4 mb-4 text-sm text-slate-600">
                Payments for {mentor.name} aren't set up yet. Please check back soon.
              </div>
            )}

            {payment && payment.configured && !verified && (
              <>
                <div className="card p-4 mb-4">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Pay via {payment.method}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-sm">{payment.account}</span>
                    <button onClick={copyAccount} className="pill glass" style={{ padding: '4px 12px', fontSize: 12 }}>
                      <Icon name="external" className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">Pay {rateLabel(mentor)} to {payment.holderName} in your bank or wallet app, then paste the receipt link or reference below.</div>
                </div>

                <label className="block text-sm font-medium mb-1">Receipt link or reference</label>
                <input
                  value={receipt}
                  onChange={e => { setReceipt(e.target.value); setError(''); }}
                  placeholder="e.g. links.et/r/AB12CD34 or a transaction reference"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 mb-2"
                  disabled={busy}
                />
                {error && <div className="text-sm text-rose-600 mb-2">{error}</div>}

                <button onClick={runVerify} disabled={busy} className="btn-primary w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
                  {busy ? 'Verifying with the bank…' : 'Verify payment'}
                </button>
              </>
            )}

            {verified && (
              <>
                <div className="card p-4 mb-4" style={{ background: 'rgba(16,185,129,.08)', borderColor: 'rgba(16,185,129,.35)' }}>
                  <div className="flex items-center gap-2 font-semibold text-emerald-700 mb-2">
                    <Icon name="check" className="w-4 h-4" /> Payment verified
                  </div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-500">Bank</span><span className="font-medium">{verified.bank}</span></div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-500">Reference</span><span className="font-medium font-mono">{verified.reference}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Amount</span><span className="font-medium">ETB {verified.amount.toLocaleString()}</span></div>
                </div>
                <button onClick={confirmPaidBooking} className="btn-primary w-full py-2.5 rounded-lg text-sm">Confirm booking</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
