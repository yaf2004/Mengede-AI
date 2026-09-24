import { useEffect, useRef, useState } from 'react';
import { useVoxideVoice } from '@voxide/react';
import { Icon } from '../lib/icons.jsx';
import Orb from '../components/Orb.jsx';
import { useAppState } from '../context/AppStateContext.jsx';
import { useSettings, VOICES } from '../context/SettingsContext.jsx';
import { useSpeech } from '../hooks/useSpeech.js';
import { useToast } from '../context/ToastContext.jsx';
import { QUICK_ACTIONS } from '../data/content.js';
import { ai, initVoxide } from '../lib/voxide.js';
import { useVoxideInit } from '../hooks/useVoxideInit.js';

const STATUS_TEXT = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  executing: 'Working on it…',
  error: 'Connection problem',
};
const SESSION_ACTIVE = new Set(['connecting', 'listening', 'thinking', 'speaking', 'executing']);

export default function Assistant() {
  const { chatOffset } = useAppState();
  const { settings } = useSettings();
  const { speak } = useSpeech(settings);
  const flash = useToast();
  const voice = useVoxideVoice(ai);
  const init = useVoxideInit();
  const [input, setInput] = useState('');
  const bodyRef = useRef(null);

  const messages = voice.messages.slice(chatOffset);
  const sessionActive = SESSION_ACTIVE.has(voice.status);
  const working = voice.status === 'thinking' || voice.status === 'executing';
  const ready = init.status === 'ready';

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, working]);

  // Voice or text can only start once the Voxide client has loaded its config.
  function guardReady() {
    if (ready) return true;
    if (init.status === 'error') { initVoxide(); flash('Reconnecting to the voice service…'); }
    else flash('The voice assistant is still loading…');
    return false;
  }

  function toggleMic() {
    if (sessionActive) { voice.disconnect(); return; }
    if (guardReady()) voice.connect();
  }

  function send(text) {
    const t = text.trim();
    if (!t || !guardReady()) return;
    voice.sendText(t);
  }

  function sendChat() {
    send(input);
    setInput('');
  }

  const usageLimit = voice.errorCode === 'usage_limit' || init.error?.code === 'usage_limit';
  let problem = null;
  if (init.status === 'error') {
    problem = usageLimit
      ? 'The voice assistant has reached its limit for now. Try again later.'
      : "Couldn't reach the voice service. Check your connection, then try again.";
  } else if (voice.status === 'error') {
    problem = usageLimit
      ? 'The voice assistant has reached its limit for now. Try again later.'
      : 'The voice connection dropped. Check that microphone access is allowed, then tap the mic to retry.';
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Orb size="md" thinking={working} />
        <div>
          <div className="font-bold text-lg leading-tight">Mengede AI</div>
          <div className="text-sm text-slate-500">{STATUS_TEXT[voice.status] || 'Your pathway assistant'}</div>
        </div>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto card p-4 mb-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="mb-4"><Orb size="lg" /></div>
            <div className="font-bold mb-1">Ask me anything about your path</div>
            <div className="text-sm text-slate-500 mb-1">Tap the mic and speak, or type below.</div>
            <div className="text-sm text-slate-500 mb-5">ለመናገር ንካ</div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.map(q => (
                <button key={q.label} onClick={() => send(q.prompt)} className="pill glass text-left flex items-center gap-2" style={{ fontSize: 12.5 }}>
                  <Icon name={q.icon} className="w-3.5 h-3.5" /> {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex mb-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-4 py-2.5 text-sm ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}
                  style={m.partial ? { opacity: 0.8 } : undefined}
                >
                  {m.text}
                  {m.role === 'ai' && !m.partial && (
                    <div>
                      <button className="glass speak-btn" onClick={() => speak(m.text)}>
                        <Icon name="volume" className="w-3.5 h-3.5" /> Listen · {VOICES[settings.voice].name}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {working && (
              <div className="flex items-center gap-2 mb-3">
                <Orb size="sm" thinking />
                <span className="text-xs text-slate-400">{voice.currentAction ? 'Working on it…' : 'Thinking…'}</span>
              </div>
            )}
          </>
        )}
      </div>

      {problem && (
        <div className="text-sm text-rose-600 mb-2 shrink-0">
          {problem}
          {init.status === 'error' && (
            <button onClick={() => initVoxide()} className="ml-2 underline font-medium">Try again</button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 shrink-0">
        <button
          onClick={toggleMic}
          title={sessionActive ? 'Stop the voice session' : 'Talk to Mengede AI'}
          aria-label={sessionActive ? 'Stop the voice session' : 'Talk to Mengede AI'}
          className={`w-10 h-10 rounded-xl glass flex items-center justify-center shrink-0 ${sessionActive ? 'glass-amber' : ''}`}
        >
          <Icon name="mic" className={sessionActive ? 'text-rose-500' : ''} />
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
          type="text"
          placeholder="Ask Mengede AI anything about your path..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400"
        />
        <button onClick={sendChat} aria-label="Send" className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center shrink-0">
          <Icon name="send" />
        </button>
      </div>
    </div>
  );
}
