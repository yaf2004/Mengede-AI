import { createContext, useContext, useEffect, useState } from 'react';
import { ai } from '../lib/voxide.js';
import {
  getStudentProfile,
  listBookings,
  clearBookings as clearBookingsApi
} from '../lib/api.js';
import { MENTORS } from '../data/mentors.js';

const AppStateContext = createContext(null);

function withMentor(booking) {
  const mentor = MENTORS.find(m => m.id === booking.mentor_id);
  return mentor ? { ...booking, mentor } : null;
}

function fromServerProfile(serverProfile, current) {
  return {
    ...current,
    interests: Array.isArray(serverProfile.interests)
      ? serverProfile.interests.join(', ')
      : serverProfile.interests || current.interests,
    goals: serverProfile.goal || current.goals,
    skills: Array.isArray(serverProfile.strengths)
      ? serverProfile.strengths
      : current.skills,
  };
}

export function AppStateProvider({ children }) {
  const [profile, setProfile] = useState({
    name: 'Student',
    interests: 'AI, Robotics, Entrepreneurship',
    goals: '',
    skills: ['Python basics', 'Public speaking'],
    completion: 65,
  });
  const [chatOffset, setChatOffset] = useState(0);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    getStudentProfile().then(res => {
      if (res.ok && res.profile) {
        setProfile(current => fromServerProfile(res.profile, current));
      }
    });

    listBookings().then(res => {
      if (res.ok) {
        setBookings(res.bookings.map(withMentor).filter(Boolean));
      }
    });
  }, []);

  const value = {
    profile,
    setProfile,
    chatOffset,
    clearChat: () => setChatOffset(ai.getSnapshot().messages.length),
    bookings,
    addBooking: booking => setBookings(list => [...list, booking]),
    clearBookings: async () => {
      const result = await clearBookingsApi();
      if (result.ok) setBookings([]);
      return result;
    },
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used inside <AppStateProvider>');
  }
  return ctx;
}
