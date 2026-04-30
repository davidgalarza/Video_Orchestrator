import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ProjectView } from './pages/ProjectView';

import { NotificationProvider } from './components/Notification';

function App() {
  return (
    <Router>
      <NotificationProvider>
        <div className="min-h-screen bg-black text-zinc-50">
          <nav className="border-b border-zinc-900 px-8 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black uppercase tracking-tighter text-zinc-400">Vid_Gen <span className="text-zinc-700">/</span> Veo</h1>
            </div>
          </nav>
          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/project/:id" element={<ProjectView />} />
            </Routes>
          </main>
        </div>
      </NotificationProvider>
    </Router>
  );
}

export default App;
