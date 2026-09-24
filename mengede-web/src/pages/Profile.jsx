import { useState } from 'react';
import { Icon } from '../lib/icons.jsx';
import { useAppState } from '../context/AppStateContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Profile() {
  const { profile, setProfile } = useAppState();
  const [draft, setDraft] = useState(profile);
  const flash = useToast();

  function save() {
    setProfile(draft);
    flash('Profile saved');
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-1">Profile</h1>
      <p className="text-slate-500 mb-6">This is what Mengede AI uses to personalize your recommendations.</p>

      <div className="card p-5 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
          {draft.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="font-bold text-lg">{draft.name}</div>
          <div className="flex gap-2 mt-1">
            <span className="pill badge-student">Student</span>
            <span className="pill badge-xp2">1,250 XP</span>
          </div>
        </div>
        <button className="border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 shrink-0">
          <Icon name="camera" className="w-4 h-4" /> Choose File
        </button>
      </div>

      <div className="card p-5 mb-6 space-y-4">
        <Field label="Name" value={draft.name} onChange={v => setDraft(d => ({ ...d, name: v }))} />
        <Field label="Interests" value={draft.interests} onChange={v => setDraft(d => ({ ...d, interests: v }))} hint="Comma-separated — this drives your dashboard feed" />
        <Field label="Goals" value={draft.goals} onChange={v => setDraft(d => ({ ...d, goals: v }))} textarea placeholder="What are you hoping to figure out or achieve?" />
      </div>

      <div className="flex justify-end">
        <button onClick={save} className="btn-primary px-5 py-2.5 rounded-lg text-sm flex items-center gap-2">
          <Icon name="save" className="w-4 h-4" /> Save Profile
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, hint, textarea, placeholder }) {
  const Comp = textarea ? 'textarea' : 'input';
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <Comp
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-400"
      />
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
