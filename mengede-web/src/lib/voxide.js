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
    description:
      'Ask Mengede to reason about the student using their profile, exploration history, universities, pathways and current external information. Use this for university or department decisions instead of guessing.',
    params: {
      text: {
        type: 'string',
        required: true,
        description: 'The student question',
      },
    },
    handler: async ({ text }) => {
      const result = await askMengede(text);

      return result.ok
        ? result
        : {
            status: 'error',
            message:
              result.error || 'Mengede could not answer right now.',
          };
    },
  },

  updateProfile: {
    description:
      'Save what the student has told you about their interests, goals or skills to their profile. Call it when they share something worth remembering, not for every message.',
    params: {
      interests: {
        type: 'string',
        description:
          'Comma-separated interests to add, e.g. "AI, robotics"',
      },
      goals: {
        type: 'string',
        description: 'What the student wants to achieve, in their own words',
        sensitive: true,
      },
      skills: {
        type: 'string',
        description:
          'Comma-separated skills to add, e.g. "Python basics, public speaking"',
      },
    },
    handler: args => {
      if (!host.updateProfile) return notReady();

      const patch = {
        interests: splitList(args?.interests),
        skills: splitList(args?.skills),
        goals:
          typeof args?.goals === 'string'
            ? args.goals.trim()
            : '',
      };

      if (
        !patch.interests.length &&
        !patch.skills.length &&
        !patch.goals
      ) {
        return {
          status: 'error',
          message:
            'Nothing to save. Ask the student what they want to add.',
        };
      }

      return {
        status: 'ok',
        profile: host.updateProfile(patch),
      };
    },
  },

  listMentors: {
    description:
      'List the mentors students can book, optionally filtered by a topic such as robotics, entrepreneurship or study skills. Returns real mentor names, roles, prices and open time slots with already booked slots excluded.',
    params: {
      topic: {
        type: 'string',
        description: 'Optional topic or skill to filter by',
      },
    },
    handler: async ({ topic } = {}) => {
      const q = String(topic || '').trim().toLowerCase();

      const matches = q
        ? MENTORS.filter(mentor =>
            [mentor.role, mentor.bio, ...mentor.tags]
              .join(' ')
              .toLowerCase()
              .includes(q)
          )
        : MENTORS;

      const shown = matches.length ? matches : MENTORS;

      const takenLists = await Promise.all(
        shown.map(mentor => getMentorTakenSlots(mentor.id))
      );

      const list = shown.map((mentor, index) => {
        const taken = new Set(
          takenLists[index]?.ok
            ? takenLists[index].taken
            : []
        );

        return {
          name: mentor.name,
          role: mentor.role,
          topics: mentor.tags,
          price: rateLabel(mentor),
          minutes: mentor.duration,
          openSlots: mentor.slots.filter(
            slot => !taken.has(slot)
          ),
        };
      });

      return {
        mentors: list,
        note:
          q && !matches.length
            ? `No mentor is tagged "${topic}"; showing everyone.`
            : undefined,
      };
    },
  },

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