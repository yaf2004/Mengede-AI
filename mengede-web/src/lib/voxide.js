import { VoxideClient } from '@voxide/react';
import { MENTORS, rateLabel } from '../data/mentors.js';
import { createBooking, getMentorTakenSlots } from './api.js';

// Publishable key: safe to ship in the browser. Override per environment with
// VITE_VOXIDE_PUBLIC_KEY (see .env.example).
const PUBLIC_KEY =
  import.meta.env.VITE_VOXIDE_PUBLIC_KEY || 'vox_pub_5e6352c01a162b52728cddc8344a70f71bc9643f07a8bed8';

// One client for the whole app. The voice session lives inside it, so it survives page changes.
export const ai = new VoxideClient({ publicKey: PUBLIC_KEY });

// The capabilities below need React state (profile, bookings, router). <VoxideBridge> fills
// these in while it is mounted, so this file can stay plain JS and register everything once.
export const host = {
  navigate: null,       // (path) => void
  getState: null,       // () => object the agent can see on every turn
  addBooking: null,     // (booking) => void — call after the booking is already persisted
};

function notReady() {
  return { status: 'error', message: 'The app is not ready yet. Try again in a moment.' };
}

// --- Navigation: the agent can only go to these exact routes ------------------------------
ai.enableNavigation({ push: (route) => host.navigate?.(route) }, {
  '/': "Dashboard: the student's recommended feed and profile progress",
  '/assistant': 'The AI assistant chat page',
  '/mentors': 'Browse mentors and book sessions',
  '/community': 'Community posts from other students',
  '/profile': "The student's profile: interests, goals and skills",
  '/settings': 'Voice, theme and language settings',
});

// Whatever this returns is visible to the agent on every turn. Keep it small and non-identifying.
ai.bindState(() => host.getState?.() ?? {});

function splitList(value) {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean);
}

function findMentor(name) {
  const q = String(name || '').trim().toLowerCase();
  if (!q) return null;
  return MENTORS.find(m => m.name.toLowerCase() === q)
    || MENTORS.find(m => m.name.toLowerCase().includes(q) || q.includes(m.name.split(' ')[0].toLowerCase()))
    || null;
}

// Voice can mishear, so a booking that is about to be made asks the student to confirm first.
// We can't check the slot is still open here without an extra round trip, so anything that
// isn't obviously a free-mentor booking (unknown mentor, paid session) skips the dialog: the
// handler itself explains the problem to the agent, which relays it to the student.
ai.onConfirmation((action, args) => {
  if (action.name !== 'bookMentorSession') {
    return typeof window !== 'undefined' && window.confirm(`Confirm: ${action.description}`);
  }
  const mentor = findMentor(args?.mentorName);
  if (!mentor || mentor.rate > 0 || !mentor.slots.includes(args?.slot)) return true;
  return typeof window !== 'undefined' && window.confirm(`Book ${mentor.name} for ${args.slot}?`);
});

ai.register({
  updateProfile: {
    description:
      "Save what the student has told you about their interests, goals or skills to their profile. Call it when they share something worth remembering, not for every message.",
    params: {
      interests: { type: 'string', description: 'Comma-separated interests to add, e.g. "AI, robotics"' },
      goals: { type: 'string', description: 'What the student wants to achieve, in their own words', sensitive: true },
      skills: { type: 'string', description: 'Comma-separated skills to add, e.g. "Python basics, public speaking"' },
    },
    handler: (args) => {
      if (!host.updateProfile) return notReady();
      const patch = {
        interests: splitList(args.interests),
        skills: splitList(args.skills),
        goals: typeof args.goals === 'string' ? args.goals.trim() : '',
      };
      if (!patch.interests.length && !patch.skills.length && !patch.goals) {
        return { status: 'error', message: 'Nothing to save. Ask the student what they want to add.' };
      }
      return { status: 'ok', profile: host.updateProfile(patch) };
    },
  },

  listMentors: {
    description:
      'List the mentors students can book, optionally filtered by a topic such as robotics, entrepreneurship or study skills. Returns real mentor names, roles, prices and open time slots (already booked slots excluded).',
    params: {
      topic: { type: 'string', description: 'Optional topic or skill to filter by' },
    },
    handler: async ({ topic } = {}) => {
      const q = String(topic || '').trim().toLowerCase();
      const matches = q
        ? MENTORS.filter(m => [m.role, m.bio, ...m.tags].join(' ').toLowerCase().includes(q))
        : MENTORS;
      const shown = matches.length ? matches : MENTORS;
      // Slot availability is shared across every student, so ask the server, not local state.
      const takenLists = await Promise.all(shown.map(m => getMentorTakenSlots(m.id)));
      const list = shown.map((m, i) => {
        const taken = new Set(takenLists[i]?.ok ? takenLists[i].taken : []);
        return {
          name: m.name,
          role: m.role,
          topics: m.tags,
          price: rateLabel(m),
          minutes: m.duration,
          openSlots: m.slots.filter(s => !taken.has(s)),
        };
      });
      return {
        mentors: list,
        note: q && !matches.length ? `No mentor is tagged "${topic}"; showing everyone.` : undefined,
      };
    },
  },

  bookMentorSession: {
    description:
      'Book a session with a mentor at one of their open time slots. Free sessions are booked immediately. Paid sessions are not booked here: the student is taken to the Mentors page to pay and submit a receipt.',
    params: {
      mentorName: { type: 'string', required: true, description: 'Mentor name as returned by listMentors' },
      slot: { type: 'string', required: true, description: 'One of the mentor\'s open slots, copied exactly from listMentors' },
    },
    requireConfirmation: true,
    handler: async ({ mentorName, slot }) => {
      if (!host.addBooking) return notReady();
      const mentor = findMentor(mentorName);
      if (!mentor) {
        return { status: 'error', message: `No mentor called "${mentorName}".`, mentors: MENTORS.map(m => m.name) };
      }
      if (!mentor.slots.includes(slot)) {
        return { status: 'error', message: `"${slot}" is not one of ${mentor.name}'s slots.`, openSlots: mentor.slots };
      }
      if (mentor.rate > 0) {
        host.navigate?.('/mentors');
        return {
          status: 'payment_required',
          message: `${mentor.name}'s session costs ${rateLabel(mentor)}. Tell the student to open Book a Session on the Mentors page, pick the time and pay; it cannot be booked by voice.`,
        };
      }
      // The server is the one that actually decides the slot is still free — a person could be
      // booking it right now through the UI.
      const res = await createBooking(mentor.id, slot);
      if (!res.ok) {
        return { status: 'error', message: res.error || 'That slot was just taken. Ask the student to pick another.' };
      }
      host.addBooking({ ...res.booking, mentor });
      return { status: 'booked', mentor: mentor.name, slot };
    },
  },
});

// --- Init state, so the UI can show loading / error and retry -----------------------------
let initState = { status: 'idle', error: null };
let initPromise = null;
const initListeners = new Set();

function setInitState(next) {
  initState = next;
  initListeners.forEach(fn => fn());
}

export const getInitState = () => initState;
export function subscribeInit(fn) {
  initListeners.add(fn);
  return () => initListeners.delete(fn);
}

// Safe to call more than once. A failed init can be retried by calling it again.
export function initVoxide() {
  if (initPromise) return initPromise;
  setInitState({ status: 'loading', error: null });
  initPromise = ai.init()
    .then(() => setInitState({ status: 'ready', error: null }))
    .catch(error => {
      initPromise = null;
      setInitState({ status: 'error', error });
    });
  return initPromise;
}
