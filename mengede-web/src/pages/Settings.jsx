import { Icon } from '../lib/icons.jsx';
import { useSettings, VOICES } from '../context/SettingsContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useSpeech, useVoicesReady } from '../hooks/useSpeech.js';
import { useAppState } from '../context/AppStateContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const RATES = [[0.8, 'Slower'], [1, 'Normal'], [1.2, 'Faster']];

export default function Settings() {
  useVoicesReady();
  const { settings, set, reset } = useSettings();
  const { dark, setDark } = useTheme();
  const { speak } = useSpeech(settings);
  const { clearChat, clearBookings } = useAppState();
  const flash = useToast();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-1">Settings</h1>
      <p className="text-slate-500 mb-6">Tune how Mengede looks and sounds.</p>

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 font-bold mb-3"><Icon name="volume" className="text-blue-500" /> Assistant voice</div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(VOICES).map(([key, v]) => (
            <button
              key={key}
              onClick={() => set('voice', key)}
              className={`voice-card glass ${settings.voice === key ? 'sel' : ''}`}
            >
              <div className="font-semibold">{v.name}</div>
              <div className="text-xs text-slate-500">{v.gender} · {v.desc}</div>
              <span
                className="pill glass"
                style={{ padding: '4px 12px', fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); speak('Selam! I am Mengede AI. Ask me anything about your path.', key); }}
              >
                <Icon name="volume" className="w-3.5 h-3.5" /> Preview
              </span>
            </button>
          ))}
        </div>
        <div className="set-row">
          <div>
            <div className="font-medium">Speak replies aloud</div>
            <div className="text-sm text-slate-500">Read Mengede AI's answers out loud automatically</div>
          </div>
          <div className={`switch ${settings.speak ? 'on' : ''}`} onClick={() => set('speak', !settings.speak)} />
        </div>
        <div className="set-row">
          <div><div className="font-medium">Speech speed</div></div>
          <div className="flex gap-2">
            {RATES.map(([r, l]) => (
              <span key={r} className={`pill glass ${settings.rate === r ? 'active' : ''}`} onClick={() => set('rate', r)}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 font-bold mb-2"><Icon name="sun" className="text-blue-500" /> Appearance</div>
        <div className="set-row">
          <div className="font-medium">Theme</div>
          <div className="flex gap-2">
            <span className={`pill glass ${!dark ? 'active' : ''}`} onClick={() => setDark(false)}><Icon name="sun" className="w-3.5 h-3.5" /> Light</span>
            <span className={`pill glass ${dark ? 'active' : ''}`} onClick={() => setDark(true)}><Icon name="moon" className="w-3.5 h-3.5" /> Dark</span>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 font-bold mb-2"><Icon name="message-circle" className="text-blue-500" /> Language</div>
        <div className="set-row">
          <div>
            <div className="font-medium">Response language</div>
            <div className="text-sm text-slate-500">Mengede AI replies (and reads answers) in this language by default</div>
          </div>
          <div className="flex gap-2">
            <span className={`pill glass ${settings.lang !== 'am' ? 'active' : ''}`} onClick={() => set('lang', 'en')}>English</span>
            <span className={`pill glass ${settings.lang === 'am' ? 'active' : ''}`} onClick={() => set('lang', 'am')}>አማርኛ</span>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 font-bold mb-2"><Icon name="home" className="text-blue-500" /> Dashboard</div>
        <div className="set-row">
          <div>
            <div className="font-medium">Show streak & XP stats</div>
            <div className="text-sm text-slate-500">Display gamification pills at the top of your dashboard</div>
          </div>
          <div className={`switch ${settings.showStats ? 'on' : ''}`} onClick={() => set('showStats', !settings.showStats)} />
        </div>
      </div>

      <div className="card p-5 mb-10">
        <div className="flex items-center gap-2 font-bold mb-3"><Icon name="settings" className="text-blue-500" /> Data</div>
        <div className="flex flex-wrap gap-2">
          <button className="pill glass" onClick={() => { clearChat(); flash('Chat history cleared'); }}>Clear chat history</button>
          <button className="pill glass" onClick={() => { clearBookings(); flash('Bookings cleared'); }}>Clear mentor bookings</button>
          <button className="pill glass glass-amber" onClick={() => { reset(); flash('Settings reset to default'); }}>Reset settings</button>
        </div>
      </div>
    </div>
  );
}
