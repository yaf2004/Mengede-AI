import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { AppStateProvider } from './context/AppStateContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Assistant from './pages/Assistant.jsx';
import Settings from './pages/Settings.jsx';
import Mentors from './pages/Mentors.jsx';
import Community from './pages/Community.jsx';
import Profile from './pages/Profile.jsx';
import VoxideBridge from './components/VoxideBridge.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AppStateProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/assistant" element={<Assistant />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/mentors" element={<Mentors />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
              </Routes>
              <VoxideBridge />
            </BrowserRouter>
          </ToastProvider>
        </AppStateProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
