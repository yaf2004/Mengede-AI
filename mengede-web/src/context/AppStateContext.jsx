import { createContext, useContext, useEffect, useState } from 'react';
import { ai } from '../lib/voxide.js';
import { listBookings, clearBookings as clearBookingsApi } from '../lib/api.js';
import { MENTORS } from '../data/mentors.js';

const AppStateContext = createContext(null);

// The server only knows mentor_id/slot; attach the display info the UI needs.
function withMentor(booking) {
  const mentor = MENTORS.find(m => m.id === booking.mentor_id);
  return mentor ? { ...booking, mentor } : null;
}

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

  // Bookings are persisted server-side (MongoDB) and scoped to this browser's device id — load
  // them once so a refresh doesn't lose them. (Profile is still local-only; wiring it to the
  // existing StudentProfile model in mengede-server/models/index.js is a separate change, since
  // that schema's shape — stage/grade/subjects — doesn't match this profile's shape yet.)
  useEffect(() => {
    listBookings().then(res => {
      if (res.ok) setBookings(res.bookings.map(withMentor).filter(Boolean));
    });
  }, []);

  const value = {
    profile, setProfile,
    chatOffset,
    clearChat: () => setChatOffset(ai.getSnapshot().messages.length),
    bookings,
    // The booking must already be persisted server-side (by /api/verify-receipt or
    // /api/bookings) before this is called — it only updates what the UI shows.
    addBooking: (b) => setBookings(list => [...list, b]),
    clearBookings: () => { clearBookingsApi(); setBookings([]); },
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
