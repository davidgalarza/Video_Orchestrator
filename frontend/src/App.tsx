import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Studio } from './pages/Studio';
import { NotificationProvider } from './components/Notification';

function App() {
  return (
    <Router>
      <NotificationProvider>
        <div className="min-h-screen bg-[#09090b] text-zinc-50">
          <main>
            <Routes>
              <Route path="/" element={<Studio />} />
            </Routes>
          </main>
        </div>
      </NotificationProvider>
    </Router>
  );
}

export default App;
