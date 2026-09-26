import { VoxideClient } from '@voxide/react';
import { MENTORS, rateLabel } from '../data/mentors.js';
import {
  createBooking,
  getMentorTakenSlots,
  askMengede,
} from './api.js';

const PUBLIC_KEY =
  import.meta.env.VITE_VOXIDE_PUBLIC_KEY ||
  'vox_pub_5e6352c01a162b52728cddc8344a70f71bc9643f07a8bed8';

export const ai = new VoxideClient({ publicKey: PUBLIC_KEY });

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
            message: result.error || 'Mengede could not answer right now.',
          };
    },
  },

  updateProfile: {
    description:
      'Save information the student explicitly shares about interests, goals or skills.',
    params: {
      interests: { type: 'string' },
      goals: { type: 'string', sensitive: true },
      skills: { type: 'string' },
    },
    handler: async args => {
      if (!host.updateProfile) return notReady();

      return host.updateProfile({
        interests: String(args?.interests || '')
          .split(',')
          .map(value => value.trim())
          .filter(Boolean),
        skills: String(args?.skills || '')
          .split(',')
          .map(value => value.trim())
          .filter(Boolean),
        goals: String(args?.goals || '').trim(),
      });
    },
  },

  listMentors: {
    description: 'List mentors students can book.',
    params: {
      topic: { type: 'string' },
    },
    handler: async ({ topic } = {}) => {
      const query = String(topic || '').toLowerCase();
      const mentors = query
        ? MENTORS.filter(mentor =>
            [mentor.role, mentor.bio, ...mentor.tags]
              .join(' ')
              .toLowerCase()
              .includes(query)
          )
        : MENTORS;

      const shown = mentors.length ? mentors : MENTORS;
      const taken = await Promise.all(
        shown.map(mentor => getMentorTakenSlots(mentor.id))
      );

      return {
        mentors: shown.map((mentor, index) => ({
          name: mentor.name,
          role: mentor.role,
          topics: mentor.tags,
          price: rateLabel(mentor),
          openSlots: mentor.slots.filter(
            slot => !(taken[index]?.taken || []).includes(slot)
          ),
        })),
      };
    },
  },

  bookMentorSession: {
    description:
      'Book a free mentor slot or navigate to payment for paid sessions.',
    params: {
      mentorName: { type: 'string', required: true },
      slot: { type: 'string', required: true },
    },
    requireConfirmation: true,
    handler: async ({ mentorName, slot }) => {
      const mentor = MENTORS.find(
        item =>
          item.name.toLowerCase() === String(mentorName).toLowerCase() ||
          item.name
            .toLowerCase()
            .includes(String(mentorName).toLowerCase())
      );

      if (!mentor) {
        return {
          status: 'error',
          message: 'Mentor not found.',
        };
      }

      if (mentor.rate > 0) {
        host.navigate?.('/mentors');
        return {
          status: 'payment_required',
          message: 'Open Mentors to complete payment.',
        };
      }

      const result = await createBooking(mentor.id, slot);

      if (!result.ok) {
        return {
          status: 'error',
          message: result.error || 'That slot is no longer available.',
        };
      }

      host.addBooking?.({ ...result.booking, mentor });

      return {
        status: 'booked',
        mentor: mentor.name,
        slot,
      };
    },
  },
});

let initState = {
  status: 'idle',
  error: null,
};
let initPromise = null;
const listeners = new Set();

function setInitState(next) {
  initState = next;
  listeners.forEach(listener => listener());
}

export const getInitState = () => initState;

export const subscribeInit = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function initVoxide() {
  if (initPromise) return initPromise;

  setInitState({
    status: 'loading',
    error: null,
  });

  initPromise = ai
    .init()
    .then(() => setInitState({ status: 'ready', error: null }))
    .catch(error => {
      initPromise = null;
      setInitState({ status: 'error', error });
      return undefined;
    });

  return initPromise;
}
