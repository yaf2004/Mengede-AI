import { Icon } from '../lib/icons.jsx';

export default function TopbarMobile({ onOpen }) {
  return (
    <div className="mobile-topbar md:hidden fixed top-0 left-0 right-0 h-14 border-b flex items-center px-4 z-20">
      <button onClick={onOpen} className="glass p-2 -ml-2 rounded-xl"><Icon name="menu" /></button>
      <span className="ml-2 font-bold">Mengede</span>
    </div>
  );
}
