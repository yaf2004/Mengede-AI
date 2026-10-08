import { VoxideClient } from '@voxide/react';
import { MENTORS, rateLabel } from '../data/mentors.js';
import { createBooking, getMentorTakenSlots, askMengede } from './api.js';

const PUBLIC_KEY =
  import.meta.env.VITE_VOXIDE_PUBLIC_KEY ||
  'vox_pub_5e6352c01a162b52728cddc8344a70f71bc9643f07a8bed8';

// One client for the whole app. The voice session lives inside it, so it survives page changes.
export const ai = new VoxideClient({ publicKey: PUBLIC_KEY }); window.__mengedeAi = ai;

export const host = {
  navigate: null,
  getState: null,
  addBooking: null,
  updateProfile: null,
};

const notReady = () => ({
  status: 'error',
  message: 'The app is not ready yet. Try again in a moment.',
});

ai.enableNavigation(
  {
    push: route => host.navigate?.(route),
  },
  {
    '/': 'Dashboard: recommended universities, pathways and resources',
    '/assistant': 'Mengede AI assistant',
    '/universities/:slug': 'University exploration',
    '/pathways/:slug': 'Pathway exploration',
    '/mentors': 'Mentors and booking',
    '/community': 'Student community',
    '/profile': 'Student profile',
    '/settings': 'Settings',
  }
);

ai.bindState(() => host.getState?.() ?? {});

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function findMentor(name) {
  const q = String(name || '').trim().toLowerCase();

  if (!q) return null;

  return (
    MENTORS.find(mentor => mentor.name.toLowerCase() === q) ||
    MENTORS.find(
      mentor =>
        mentor.name.toLowerCase().includes(q) ||
        q.includes(mentor.name.split(' ')[0].toLowerCase())
    ) ||
    null
  );
}

// Voice can mishear, so free mentor bookings require confirmation.
ai.onConfirmation((action, args) => {
  if (action.name !== 'bookMentorSession') {
    return (
      typeof window !== 'undefined' &&
      window.confirm(`Confirm: ${action.description}`)
    );
  }

  const mentor = findMentor(args?.mentorName);

  if (!mentor || mentor.rate > 0 || !mentor.slots.includes(args?.slot)) {
    return true;
  }

  return (
    typeof window !== 'undefined' &&
    window.confirm(`Book ${mentor.name} for ${args.slot}?`)
  );
});

ai.register({
  askMengede: {
    description: 'For university, career, pathway, study, or personal guidance questions, send the student message to Mengede. This action connects the voice interface to Mengede\'s personalized reasoning system. Use the returned response as the answer instead of answering these questions from your own knowledge.',
    params: {
      message: { type: 'string', required: true, description: 'The student\'s complete message or question' },
    },
    handler: async ({ message }) => {
      const result = await askMengede(message, voiceConversationId);
      if (result?.ok && result.conversationId) voiceConversationId = result.conversationId;
      if (!result?.ok) return { status: 'error', message: result?.error || 'Mengede could not process that request.' };
      return { status: 'ok', message: result.message, recommendations: result.recommendations || [], sources: result.sources || [] };
    },
  },

  bookMentorSession: {
    description:
      'Book a session with a mentor at one of their open time slots. Free sessions are booked immediately. Paid sessions are not booked here: the student is taken to the Mentors page to pay and submit a receipt.',
    params: {
      mentorName: {
        type: 'string',
        required: true,
        description:
          'Mentor name as returned by listMentors',
      },
      slot: {
        type: 'string',
        required: true,
        description:
          'One of the mentor open slots, copied exactly from listMentors',
      },
    },
    requireConfirmation: true,

    handler: async ({ mentorName, slot }) => {
      if (!host.addBooking) return notReady();

      const mentor = findMentor(mentorName);

      if (!mentor) {
        return {
          status: 'error',
          message: `No mentor called "${mentorName}".`,
          mentors: MENTORS.map(m => m.name),
        };
      }

      if (!mentor.slots.includes(slot)) {
        return {
          status: 'error',
          message: `"${slot}" is not one of ${mentor.name}'s slots.`,
          openSlots: mentor.slots,
        };
      }

      if (mentor.rate > 0) {
        host.navigate?.('/mentors');

        return {
          status: 'payment_required',
          message: `${mentor.name}'s session costs ${rateLabel(
            mentor
          )}. Tell the student to open Book a Session on the Mentors page, pick the time and pay; it cannot be booked by voice.`,
        };
      }

      // The server is authoritative for slot availability.
      const result = await createBooking(mentor.id, slot);

      if (!result.ok) {
        return {
          status: 'error',
          message:
            result.error ||
            'That slot was just taken. Ask the student to pick another.',
        };
      }

      host.addBooking({
        ...result.booking,
        mentor,
      });

      return {
        status: 'booked',
        mentor: mentor.name,
        slot,
      };
    },
  },
});

// --- Init state, so the UI can show loading / error and retry -----------------------------
let voiceConversationId = null;

let initState = {
  status: 'idle',
  error: null,
};
let initPromise = null;
const initListeners = new Set();

function setInitState(next) {
  initState = next;
  initListeners.forEach(listener => listener());
}

export const getInitState = () => initState;

export const subscribeInit = listener => {
  initListeners.add(listener);
  return () => initListeners.delete(listener);
};

export function initVoxide() {
  if (initPromise) return initPromise;

  setInitState({
    status: 'loading',
    error: null,
  });

  initPromise = ai
    .init()
    .then(() => {
      setInitState({
        status: 'ready',
        error: null,
      });
    })
    .catch(error => {
      initPromise = null;

      setInitState({
        status: 'error',
        error,
      });
    });

  return initPromise;
}