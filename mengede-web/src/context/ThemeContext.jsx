import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

function getInitialDark() {
  try {
    const saved = localStorage.getItem('mengede-theme');
    if (saved) return saved === 'dark';
  } catch { /* localStorage unavailable */ }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('mengede-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  const value = { dark, setDark, toggle: () => setDark(d => !d) };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
