import { createContext, useContext, useEffect, useState } from 'react';

export const VOICES = {
  abebe: { name: 'Abebe', gender: 'Male', desc: 'Deep, calm and steady', pitch: 0.8, pitchFallback: 0.6 },
  abebech: { name: 'Abebech', gender: 'Female', desc: 'Bright, warm and clear', pitch: 1.1, pitchFallback: 1.35 },
};

const DEFAULT_SETTINGS = { voice: 'abebe', speak: true, rate: 1, showStats: true, lang: 'en' };
const SettingsContext = createContext(null);

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('mengede-settings') || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    try { localStorage.setItem('mengede-settings', JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  const set = (key, value) => setSettings(s => ({ ...s, [key]: value }));
  const reset = () => setSettings({ ...DEFAULT_SETTINGS });

  return (
    <SettingsContext.Provider value={{ settings, set, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
