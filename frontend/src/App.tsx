import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ProjectView } from './pages/ProjectView';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <nav className="border-b border-slate-800 p-4">
          <div className="container mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">Veo Orchestrator</h1>
          </div>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
