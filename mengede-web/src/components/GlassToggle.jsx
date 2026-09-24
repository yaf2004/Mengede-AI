import { Icon } from '../lib/icons.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function GlassToggle() {
  const { dark, toggle } = useTheme();
  return (
    <div className="glass-toggle" onClick={toggle} role="button" tabIndex={0}>
      <div className={`glass-toggle-thumb ${!dark ? 'right' : ''}`} />
      <div className={`glass-toggle-opt ${dark ? 'active' : ''}`}><Icon name="moon" /> Dark</div>
      <div className={`glass-toggle-opt ${!dark ? 'active' : ''}`}><Icon name="sun" /> Light</div>
    </div>
  );
}
