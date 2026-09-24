import { Link } from 'react-router-dom';
import { Icon } from '../lib/icons.jsx';
import { useAppState } from '../context/AppStateContext.jsx';
import { FEED, FEED_COLORS, FEED_LABELS } from '../data/content.js';

export default function Dashboard() {
  const { profile } = useAppState();

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Welcome back, {profile.name.split(' ')[0]}</h1>
      <p className="text-slate-500 mb-6">Here's what's relevant to your path today.</p>

      {profile.completion < 100 && (
        <div
          className="rounded-2xl p-5 mb-6 flex items-center justify-between gap-4 text-white"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}
        >
          <div>
            <div className="font-bold mb-0.5">Your profile is {profile.completion}% complete</div>
            <div className="text-sm text-blue-100">Finish it so recommendations get sharper.</div>
          </div>
          <Link to="/profile" className="glass glass-onblue font-semibold px-4 py-2 rounded-lg text-sm shrink-0">
            Complete Now →
          </Link>
        </div>
      )}

      <div className="flex gap-2 mb-8">
        <span className="pill glass glass-amber"><Icon name="flame" className="w-3.5 h-3.5" /> 7 Day Streak</span>
        <span className="pill glass glass-blue-text"><Icon name="zap" className="w-3.5 h-3.5" /> 1,250 XP</span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="pill glass glass-blue-text font-bold" style={{ padding: '8px 20px', fontSize: 17, cursor: 'default' }}>
          Recommended for you
        </h2>
        <span className="pill glass" style={{ padding: '4px 12px', fontSize: 12, cursor: 'default' }}>
          Based on: {profile.interests}
        </span>
      </div>

      <div className="space-y-3">
        {FEED.map((item, i) => (
          <div key={i} className="card p-4 flex gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${FEED_COLORS[item.color]}`}>
              <Icon name={item.icon} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{FEED_LABELS[item.type]}</div>
              <div className="font-semibold mb-1">{item.title}</div>
              <div className="text-sm text-slate-600">{item.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
