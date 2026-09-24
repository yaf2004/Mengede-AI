import { useLocation, useNavigate } from 'react-router-dom';
import Orb from './Orb.jsx';

export default function AssistantFab() {
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname === '/assistant') return null; // don't duplicate the shortcut while already inside

  return (
    <button
      id="assistantFab"
      onClick={() => navigate('/assistant')}
      title="Ask Mengede AI"
      className="fixed bottom-6 left-1/2 z-40 flex items-center justify-center"
      style={{ transform: 'translateX(-50%)', cursor: 'pointer' }}
    >
      <Orb size="fab" />
    </button>
  );
}
