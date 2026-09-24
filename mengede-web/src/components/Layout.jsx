import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopbarMobile from './TopbarMobile.jsx';
import AssistantFab from './AssistantFab.jsx';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopbarMobile onOpen={() => setSidebarOpen(true)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="md:ml-64 pt-14 md:pt-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
          <Outlet />
        </div>
      </main>

      <AssistantFab />
    </div>
  );
}
