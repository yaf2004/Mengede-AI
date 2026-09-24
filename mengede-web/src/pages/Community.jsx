import { useState } from 'react';
import { Icon } from '../lib/icons.jsx';
import { COMMUNITY_CATS, POSTS } from '../data/content.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Community() {
  const [cat, setCat] = useState('All');
  const flash = useToast();
  const visible = cat === 'All' ? POSTS : POSTS.filter(p => p.tag === cat);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-extrabold">Community</h1>
        <button className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" onClick={() => flash('New post — wire this up to your backend')}>
          <Icon name="plus" className="w-4 h-4" /> New Post
        </button>
      </div>
      <p className="text-slate-500 mb-5">Ask questions, share wins, help other students.</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {COMMUNITY_CATS.map(c => (
          <span key={c} className={`pill glass ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</span>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((p, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full ${p.color} text-white flex items-center justify-center font-bold shrink-0`}>{p.initial}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
                  <span className="font-medium text-slate-600">{p.author}</span> · {p.date}
                </div>
                <div className="font-semibold mb-1">{p.title}</div>
                <div className="text-sm text-slate-600 mb-2">{p.body}</div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Icon name="thumbs-up" className="w-3.5 h-3.5" /> {p.likes}</span>
                  <span className="flex items-center gap-1"><Icon name="message-circle" className="w-3.5 h-3.5" /> {p.comments}</span>
                  <span className="pill badge-tag">{p.tag}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
