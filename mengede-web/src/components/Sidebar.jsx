import { NavLink } from 'react-router-dom';
import { Icon } from '../lib/icons.jsx';
import GlassToggle from './GlassToggle.jsx';

export const NAV = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/assistant', label: 'Mengede AI', icon: 'sparkles' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
  { path: '/mentors', label: 'Mentors', icon: 'calendar' },
  { path: '/community', label: 'Community', icon: 'users' },
  { path: '/profile', label: 'Profile', icon: 'user' },
];

export default function Sidebar({ open, onClose }) {
  return (
    <aside id="sidebar" className={`fixed top-0 left-0 h-screen w-64 border-r flex flex-col z-40 transition-transform duration-200 ${open ? 'open' : ''}`}>
      <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-100 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
          <Icon name="graduation-cap" className="w-5 h-5" />
        </div>
        <span className="text-lg font-extrabold tracking-tight">Mengede<span className="text-blue-600">.</span></span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map(n => (
          <NavLink
            key={n.path}
            to={n.path}
            end={n.path === '/'}
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name={n.icon} /> <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <GlassToggle />
        <div className="nav-item" style={{ color: '#6b7280' }} onClick={onClose}>
          <Icon name="log-out" /> Back to Home
        </div>
      </div>
    </aside>
  );
}
