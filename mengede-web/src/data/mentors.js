// `id` must match a key in mengede-server/config/mentorPayments.js — that file, not this one,
// decides the real price and payment account. `rate` here is display-only; keep it in sync by
// hand, but a mismatch can only make the UI show a wrong price, never let someone pay less,
// since the server checks the real rate independently when verifying a receipt.
//
// Slots are generated from today's date so the weekday always matches the calendar.
// Placeholder availability: replace with each mentor's real schedule.
function slot(daysAhead, time) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day} ${d.getMonth() + 1}/${d.getDate()} · ${time}`;
}

export const MENTORS = [
  {
    id: 'selam', name: 'Selam Girma', initial: 'S', color: 'bg-blue-600',
    role: 'Robotics Engineer, AASTU Alumni', tags: ['Robotics', 'AI'],
    bio: '6 years building automation systems in Addis Ababa. Loves helping students find their first technical project.',
    rate: 500, duration: 60, pay: { method: 'Telebirr' },
    slots: [slot(1, '4:00 PM'), slot(2, '2:00 PM'), slot(4, '11:00 AM')],
  },
  {
    id: 'nathnael', name: 'Nathnael Worku', initial: 'N', color: 'bg-emerald-600',
    role: 'Founder, early-stage startup', tags: ['Entrepreneurship', 'Career'],
    bio: 'Started a company straight out of university with no business degree. Happy to talk through realistic first steps.',
    rate: 350, duration: 30, pay: { method: 'CBE' },
    slots: [slot(1, '6:30 PM'), slot(3, '1:00 PM')],
  },
  {
    id: 'hana', name: 'Hana Tesfaye', initial: 'H', color: 'bg-rose-500',
    role: 'Physics Lecturer', tags: ['Academics', 'Study Skills'],
    bio: 'Helps students prepare for entrance exams and pick a realistic academic path based on their strengths.',
    rate: 0, duration: 45,
    slots: [slot(2, '10:00 AM'), slot(4, '3:00 PM')],
  },
];

export function rateLabel(m) { return m.rate > 0 ? `ETB ${m.rate.toLocaleString()}` : 'Free'; }
export function rateDetail(m) { return m.rate > 0 ? `per ${m.duration}-min session` : `${m.duration}-min session · volunteer mentor`; }
