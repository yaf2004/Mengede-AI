import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);

  const flash = useCallback((text) => {
    setMsg(text);
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 1800);
  }, []);

  return (
    <ToastContext.Provider value={flash}>
      {children}
      <div
        className="glass"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 60,
          padding: '10px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 600,
          transition: 'opacity .3s', opacity: visible ? 1 : 0, pointerEvents: 'none',
        }}
      >
        {msg}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
