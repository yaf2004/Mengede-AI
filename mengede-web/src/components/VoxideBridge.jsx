import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppStateContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ai, host, initVoxide } from '../lib/voxide.js';
import { saveStudentProfile } from '../lib/api.js';

const dedupe = list => {
  const seen = new Set();

  return list.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function VoxideBridge() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, setProfile, addBooking } = useAppState();
  const { settings } = useSettings();
  const flash = useToast();

  useEffect(() => {
    initVoxide();
  }, []);

  useEffect(() => {
    ai.setLanguage(settings.lang === 'am' ? 'am-ET' : 'en-US');
  }, [settings.lang]);

  useEffect(() => {
    ai.setActiveRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    host.navigate = navigate;
    host.getState = () => ({
      currentPage: pathname,
      interests: profile.interests,
      goals: profile.goals,
      skills: profile.skills,
    });

    host.updateProfile = async ({ interests = [], skills = [], goals = '' }) => {
      const next = {
        ...profile,
        interests: dedupe([
          ...profile.interests.split(','),
          ...interests
        ].map(value => value.trim()).filter(Boolean)).join(', '),
        skills: dedupe([...profile.skills, ...skills]),
        goals: goals || profile.goals,
      };

      const result = await saveStudentProfile({
        stage: 'university-choice',
        grade: '',
        subjects: [],
        interests: next.interests
          .split(',')
          .map(value => value.trim())
          .filter(Boolean),
        strengths: next.skills,
        goal: next.goals,
        language: settings.lang,
      });

      if (!result.ok) {
        return {
          status: 'error',
          message: result.error || 'Could not save the profile.'
        };
      }

      setProfile(next);
      flash('Profile updated');

      return {
        status: 'ok',
        profile: {
          interests: next.interests,
          skills: next.skills,
          goals: next.goals
        }
      };
    };

    host.addBooking = booking => {
      addBooking(booking);
      flash('Session booked');
    };

    return () => {
      Object.keys(host).forEach(key => {
        host[key] = null;
      });
    };
  }, [
    navigate,
    pathname,
    profile,
    setProfile,
    addBooking,
    flash,
    settings.lang,
  ]);

  return null;
}
