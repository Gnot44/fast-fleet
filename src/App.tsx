import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LiveMonitorPage } from './pages/LiveMonitorPage';
import { PlaybackPage } from './pages/PlaybackPage';
import { Sidebar } from './components/Sidebar';

function App() {
  return (
    <Router>
      <div className="bg-surface flex h-screen overflow-hidden text-on-surface text-body-sm w-full">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<LiveMonitorPage />} />
            <Route path="/playback" element={<PlaybackPage />} />
            <Route path="*" element={<LiveMonitorPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
