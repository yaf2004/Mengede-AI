import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppStateContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ai, host, initVoxide } from '../lib/voxide.js';

// Case-insensitive, keeps the first spelling: "AI" and "ai" are the same interest.
const dedupe = (list) => {
  const seen = new Set();
  return list.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Renders nothing. Mounted once, next to <Routes>, so it stays alive on every page and the
// voice session is never cut off by navigation. It connects the Voxide agent to app state.
export default function VoxideBridge() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, setProfile, bookings, addBooking } = useAppState();
  const flash = useToast();

  useEffect(() => { initVoxide(); }, []);
  useEffect(() => { ai.setActiveRoute(pathname); }, [pathname]);

  useEffect(() => {
    host.navigate = navigate;
    host.getBookings = () => bookings;
    // The agent sees this every turn. First name and contact details are deliberately left out.
    host.getState = () => ({
      currentPage: pathname,
      interests: profile.interests,
      goals: profile.goals,
      skills: profile.skills,
      bookedSessions: bookings.map(b => `${b.mentor.name}, ${b.slot}`),
    });
    host.updateProfile = ({ interests, skills, goals }) => {
      const next = {
        ...profile,
        interests: dedupe([...profile.interests.split(','), ...interests].map(s => s.trim()).filter(Boolean)).join(', '),
        skills: dedupe([...profile.skills, ...skills]),
        goals: goals || profile.goals,
      };
      setProfile(next);
      flash('Profile updated');
      return { interests: next.interests, skills: next.skills, goals: next.goals };
    };
    host.addBooking = (booking) => {
      addBooking(booking);
      flash('Session booked');
    };
    return () => { Object.keys(host).forEach(k => { host[k] = null; }); };
  }, [navigate, pathname, profile, setProfile, bookings, addBooking, flash]);

  return null;
}
