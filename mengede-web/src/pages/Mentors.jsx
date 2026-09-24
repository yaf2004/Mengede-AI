import { useState } from 'react';
import { Icon } from '../lib/icons.jsx';
import { MENTORS, rateLabel, rateDetail } from '../data/mentors.js';
import BookingModal from '../components/BookingModal.jsx';
import { useAppState } from '../context/AppStateContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Mentors() {
  const [activeMentor, setActiveMentor] = useState(null);
  const { bookings, addBooking } = useAppState();
  const flash = useToast();

  function handleConfirm(booking) {
    addBooking(booking);
    setActiveMentor(null);
    flash(booking.paid ? 'Booked — payment verified' : 'Session booked');
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Mentors</h1>
      <p className="text-slate-500 mb-6">Book time with someone who's done what you're trying to do.</p>

      <div className="space-y-3 mb-10">
        {MENTORS.map((m, i) => (
          <div key={m.name} className="card p-5">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full ${m.color} text-white flex items-center justify-center font-bold text-lg shrink-0`}>{m.initial}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold">{m.name}</div>
                    <div className="text-sm text-slate-500">{m.role}</div>
                  </div>
                  <span className={`pill glass ${m.rate > 0 ? 'glass-blue-text' : 'glass-amber'}`} style={{ padding: '4px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'default', flexShrink: 0 }}>
                    {m.rate > 0 && <Icon name="zap" className="w-3.5 h-3.5" />} {rateLabel(m)}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{rateDetail(m)}</div>
                <p className="text-sm text-slate-600 my-3">{m.bio}</p>
                <div className="flex gap-2 flex-wrap mb-3">
                  {m.tags.map(t => <span key={t} className="pill badge-tag">{t}</span>)}
                </div>
                <button onClick={() => setActiveMentor(i)} className="btn-primary px-4 py-2 rounded-lg text-sm">Book a Session</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-bold text-lg mb-3">Upcoming sessions</h2>
      {bookings.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">No sessions booked yet.</div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b, i) => (
            <div key={i} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold">{b.mentor.name}</div>
                <div className="text-sm text-slate-500">{b.slot}</div>
                {b.paid && <div className="text-xs text-slate-400 mt-0.5">Ref: {b.reference}</div>}
              </div>
              <span className="pill badge-xp2"><Icon name="check" className="w-3.5 h-3.5" /> {b.paid ? 'Paid · Verified' : 'Confirmed'}</span>
            </div>
          ))}
        </div>
      )}

      {activeMentor !== null && (
        <BookingModal mentor={MENTORS[activeMentor]} onClose={() => setActiveMentor(null)} onConfirm={handleConfirm} />
      )}
    </div>
  );
}
