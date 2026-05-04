import { useEffect, useState, useCallback } from 'react';
import { getProjects, createProject, deleteProject, getUsageSummary } from '../api';
import type { Project } from '../api';
import { 
  Folder, Plus, Trash2, Settings, Library, 
  Menu, X, Sparkles,
  Command, Terminal, Wand2, BarChart3, Video
} from 'lucide-react';
import { ProjectEditor } from '../components/ProjectEditor';
import { LibraryView } from '../components/LibraryView';
import { SettingsView } from '../components/SettingsView';
import { ImageGenView } from './ImageGenView';
import { UsageView } from './UsageView';
import { VideoLibraryView } from './VideoLibraryView';
import { useNotification } from '../components/Notification';

export function Studio() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [view, setView] = useState<'editor' | 'library' | 'settings' | 'imagegen' | 'usage' | 'videos'>('editor');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [usage, setUsage] = useState({ total_cost: 0 });
  const { showNotification } = useNotification();

  const fetchUsage = useCallback(async () => {
    try {
      const data = await getUsageSummary();
      setUsage(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
      if (data.length > 0 && !activeProjectId) {
        setActiveProjectId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeProjectId]);

  useEffect(() => {
    fetchProjects();
    fetchUsage();
  }, [fetchProjects, fetchUsage]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const p = await createProject(newProjectName);
      setProjects([...projects, p]);
      setActiveProjectId(p.id);
      setNewProjectName('');
      setView('editor');
      showNotification(`Created flow: ${p.name}`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      showNotification(message, 'error');
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Destroy this flow?')) return;
    try {
      await deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
      if (activeProjectId === id) setActiveProjectId(projects[0]?.id || null);
      showNotification('Flow deleted', 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete project';
      showNotification(message, 'error');
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-400 overflow-hidden font-sans selection:bg-zinc-100 selection:text-black">
      {/* Sidebar - Explorer Style */}
      <aside 
        className={`
          ${sidebarOpen ? 'w-72' : 'w-0'} 
          bg-[#09090b] border-r border-zinc-900 flex flex-col transition-all duration-300 relative z-50 flex-shrink-0
        `}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-black">
                <Command size={18} />
             </div>
             <h1 className="text-sm font-black tracking-tighter text-zinc-100 uppercase italic">Vid_Gen Studio</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-600 hover:text-zinc-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto px-3 py-4 space-y-8">
          {/* Main Navigation */}
          <div className="space-y-1">
            <button 
              onClick={() => setView('library')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer ${view === 'library' ? 'bg-zinc-900 text-zinc-100 shadow-sm shadow-black' : 'hover:bg-zinc-900/50 hover:text-zinc-300'}`}
            >
              <Library size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Asset Library</span>
            </button>
            <button 
              onClick={() => setView('videos')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer ${view === 'videos' ? 'bg-zinc-900 text-zinc-100 shadow-sm shadow-black' : 'hover:bg-zinc-900/50 hover:text-zinc-300'}`}
            >
              <Video size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Video Library</span>
            </button>
            <button 
              onClick={() => setView('imagegen')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer ${view === 'imagegen' ? 'bg-zinc-900 text-zinc-100 shadow-sm shadow-black' : 'hover:bg-zinc-900/50 hover:text-zinc-300'}`}
            >
              <Wand2 size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Image Studio</span>
            </button>
            <button 
              onClick={() => setView('usage')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer ${view === 'usage' ? 'bg-zinc-900 text-zinc-100 shadow-sm shadow-black' : 'hover:bg-zinc-900/50 hover:text-zinc-300'}`}
            >
              <BarChart3 size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Usage & Billing</span>
            </button>
            <button 
              onClick={() => setView('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer ${view === 'settings' ? 'bg-zinc-900 text-zinc-100 shadow-sm shadow-black' : 'hover:bg-zinc-900/50 hover:text-zinc-300'}`}
            >
              <Settings size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Global Settings</span>
            </button>
          </div>

          {/* Project Explorer */}
          <div>
            <div className="px-3 mb-4 flex items-center justify-between group">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Active Flows</span>
              <Plus size={14} className="text-zinc-700 group-hover:text-zinc-400 cursor-pointer transition" />
            </div>
            
            <form onSubmit={handleCreateProject} className="px-3 mb-4">
               <div className="flex gap-2">
                 <input 
                   value={newProjectName}
                   onChange={(e) => setNewProjectName(e.target.value)}
                   placeholder="New flow name..."
                   className="flex-grow bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:border-zinc-700 transition"
                 />
                 <button 
                   type="submit" 
                   disabled={!newProjectName.trim()}
                   className="bg-zinc-100 hover:bg-white text-black px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition disabled:opacity-30 cursor-pointer"
                 >
                   Create
                 </button>
               </div>
            </form>

            <div className="space-y-0.5">
              {projects.map(p => (
                <div 
                  key={p.id}
                  onClick={() => { setActiveProjectId(p.id); setView('editor'); }}
                  className={`
                    group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all
                    ${activeProjectId === p.id && view === 'editor' ? 'bg-zinc-900 text-zinc-100 shadow-sm shadow-black' : 'hover:bg-zinc-900/40 text-zinc-500 hover:text-zinc-300'}
                  `}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Folder size={14} className={activeProjectId === p.id && view === 'editor' ? 'text-zinc-100' : 'text-zinc-700'} />
                    <span className="text-xs font-medium truncate">{p.name}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-6 border-t border-zinc-900">
           <div className="flex items-center justify-between text-zinc-700">
              <div className="flex items-center gap-2">
                 <Sparkles size={14} />
                 <span className="text-[10px] font-black uppercase tracking-widest">Orchestration</span>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 tracking-tighter">${usage.total_cost.toFixed(2)}</span>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col relative bg-[#09090b]">
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute top-6 left-6 z-50 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 shadow-2xl transition"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="flex-grow h-full">
          {view === 'editor' && activeProjectId && (
            <ProjectEditor 
              projectId={activeProjectId} 
              onNavigate={(v: 'library' | 'settings' | 'imagegen') => setView(v)} 
            />
          )}
          {view === 'library' && (
            <LibraryView activeProjectId={activeProjectId} />
          )}
          {view === 'settings' && (
            <SettingsView />
          )}
          {view === 'imagegen' && (
            <ImageGenView />
          )}
          {view === 'usage' && (
            <UsageView />
          )}
          {view === 'videos' && (
            <VideoLibraryView />
          )}
          {!activeProjectId && view === 'editor' && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
               <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700 border border-zinc-800 animate-pulse">
                  <Terminal size={32} />
               </div>
               <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Select or create a flow to begin</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
