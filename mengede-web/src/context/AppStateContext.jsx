import { createContext, useContext, useState } from 'react';
import { ai } from '../lib/voxide.js';

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [profile, setProfile] = useState({
    name: 'Student',
    interests: 'AI, Robotics, Entrepreneurship',
    goals: '',
    skills: ['Python basics', 'Public speaking'],
    completion: 65,
  });
  // Messages live in the Voxide session and are append-only, so "clearing" hides the ones before now.
  const [chatOffset, setChatOffset] = useState(0);
  const [bookings, setBookings] = useState([]);

  const value = {
    profile, setProfile,
    chatOffset,
    clearChat: () => setChatOffset(ai.getSnapshot().messages.length),
    bookings, setBookings,
    addBooking: (b) => setBookings(list => [...list, b]),
    clearBookings: () => setBookings([]),
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
