import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { askMengede } from '../lib/api.js';

const STATUS_TEXT = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  executing: 'Working on it…',
  error: 'Connection problem',
};

const ACTIVE = new Set([
  'connecting',
  'listening',
  'thinking',
  'speaking',
  'executing',
]);

export default function Assistant() {
  const { chatOffset } = useAppState();
  const { settings } = useSettings();
  const { speak } = useSpeech(settings);
  const flash = useToast();
  const voice = useVoxideVoice(ai);
  const init = useVoxideInit();

  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const bodyRef = useRef(null);

  const pending = messages.some(message => message.pending);
  const busy =
    voice.status === 'thinking' ||
    voice.status === 'executing' ||
    pending;

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, voice.messages, busy]);

  const ready = init.status === 'ready';

  function guard() {
    if (ready) return true;

    if (init.status === 'error') {
      initVoxide();
    }

    flash('The voice assistant is still loading…');
    return false;
  }

  function toggle() {
    if (ACTIVE.has(voice.status)) {
      voice.disconnect();
      return;
    }

    if (guard()) {
      voice.connect();
    }
  }

  async function send(text) {
    const trimmed = text.trim();

    if (!trimmed || pending) return;

    setInput('');
    setMessages(current => [
      ...current,
      { role: 'user', text: trimmed },
      { role: 'ai', text: 'Thinking…', pending: true },
    ]);

    const result = await askMengede(trimmed, conversationId);

    setMessages(current => {
      const index = [...current]
        .map((message, position) => ({ message, position }))
        .reverse()
        .find(({ message }) => message.pending)?.position;

      if (index == null) return current;

      const replacement = result.ok
        ? {
            role: 'ai',
            text: result.message,
            recommendations: result.recommendations,
            sources: result.sources,
          }
        : {
            role: 'ai',
            text:
              result.error ||
              'I could not reach Mengede right now.',
          };

      return current.map((message, position) =>
        position === index ? replacement : message
      );
    });

    if (result.ok && result.conversationId) {
      setConversationId(result.conversationId);
    }
  }

  const live = voice.messages.slice(chatOffset);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Orb size="md" thinking={busy} />
        <div>
          <div className="font-bold text-lg">Mengede AI</div>
          <div className="text-sm text-slate-500">
            {STATUS_TEXT[voice.status] || 'Your university decision assistant'}
          </div>
        </div>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto card p-4 mb-3">
        {messages.length === 0 && live.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="mb-4">
              <Orb size="lg" />
            </div>
            <div className="font-bold mb-1">
              Let's explore what could fit you
            </div>
            <div className="text-sm text-slate-500 mb-5">
              Ask about universities, departments, or a path you are unsure
              about.
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.slice(0, 4).map(action => (
                <button
                  type="button"
                  key={action.label}
                  onClick={() => send(action.prompt)}
                  disabled={pending}
                  className="pill glass text-left flex items-center gap-2 disabled:opacity-50"
                  style={{ fontSize: 12.5 }}
                >
                  <Icon name={action.icon} className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={'m' + index}
                className={
                  'flex mb-3 ' +
                  (message.role === 'user' ? 'justify-end' : 'justify-start')
                }
              >
                <div
                  className={
                    'max-w-[88%] px-4 py-2.5 text-sm ' +
                    (message.role === 'user'
                      ? 'chat-bubble-user'
                      : 'chat-bubble-ai')
                  }
                >
                  <div>{message.text}</div>

                  {message.recommendations?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.recommendations.map((recommendation, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="p-3 rounded-xl border border-slate-200"
                        >
                          <div className="font-semibold">
                            {recommendation.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {recommendation.reason}
                          </div>
                          <Link
                            className="inline-block mt-2 text-xs text-blue-600 font-semibold"
                            to={
                              recommendation.type === 'university'
                                ? '/universities/' + recommendation.id
                                : '/pathways/' + recommendation.id
                            }
                          >
                            Explore →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}

                  {message.sources?.length > 0 && (
                    <div className="text-xs text-slate-400 mt-3">
                      Current sources were used to ground this answer.
                    </div>
                  )}

                  {message.role === 'ai' &&
                    !message.pending &&
                    message.text && (
                      <button
                        type="button"
                        className="glass speak-btn"
                        onClick={() => speak(message.text)}
                      >
                        <Icon name="volume" className="w-3.5 h-3.5" />
                        Listen · {VOICES[settings.voice].name}
                      </button>
                    )}
                </div>
              </div>
            ))}

            {live.map((message, index) => (
              <div
                key={'v' + index}
                className={
                  'flex mb-3 ' +
                  (message.role === 'user' ? 'justify-end' : 'justify-start')
                }
              >
                <div
                  className={
                    'max-w-[80%] px-4 py-2.5 text-sm ' +
                    (message.role === 'user'
                      ? 'chat-bubble-user'
                      : 'chat-bubble-ai')
                  }
                >
                  {message.text}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 shrink-0">
        <button
          type="button"
          onClick={toggle}
          className={
            'w-10 h-10 rounded-xl glass flex items-center justify-center shrink-0 ' +
            (ACTIVE.has(voice.status) ? 'glass-amber' : '')
          }
          aria-label={
            ACTIVE.has(voice.status)
              ? 'Stop voice session'
              : 'Start voice session'
          }
        >
          <Icon name="mic" />
        </button>

        <input
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') send(input);
          }}
          type="text"
          disabled={pending}
          placeholder="Ask Mengede about universities or your path..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 disabled:opacity-60"
        />

        <button
          type="button"
          onClick={() => send(input)}
          disabled={pending}
          className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center shrink-0 disabled:opacity-50"
          aria-label="Send"
        >
          <Icon name="send" />
        </button>
      </div>
    </div>
  );
}
