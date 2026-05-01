import { useEffect, useState, useCallback } from 'react';
import { getProject, exportProject, unlinkAssetFromProject } from '../api';
import type { Project, Asset } from '../api';
import { ChatFeed } from '../components/ChatFeed';
import { PromptInput } from '../components/PromptInput';
import { 
  Settings, Share2, Info, Loader2, Sparkles, 
  Layers, Package, ExternalLink, Plus, X
} from 'lucide-react';
import { useNotification } from '../components/Notification';

export function ProjectEditor({ projectId, onNavigate }: { projectId: string, onNavigate: (v: 'library' | 'settings') => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { showNotification, hideNotification } = useNotification();

  const fetchProject = useCallback(async () => {
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    const hasProcessing = project?.scenes.some(s => s.status === 'processing');
    if (hasProcessing) {
      const interval = setInterval(fetchProject, 5000);
      return () => clearInterval(interval);
    }
  }, [project?.scenes, fetchProject]);

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    const toastId = showNotification('Stitching scenes...', 'loading');
    try {
      const { export_url } = await exportProject(project.id);
      hideNotification(toastId);
      showNotification('Master video ready!', 'success');
      window.open(export_url, '_blank');
    } catch (err: any) {
      hideNotification(toastId);
      showNotification(err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleUnlink = async (assetId: string) => {
    if (!project) return;
    const tid = showNotification('Removing reference...', 'loading');
    try {
      await unlinkAssetFromProject(project.id, assetId);
      hideNotification(tid);
      fetchProject();
    } catch (err: any) {
      hideNotification(tid);
      showNotification(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-zinc-800" size={32} />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex flex-col h-full">
      <header className="px-10 py-6 border-b border-zinc-900 bg-[#09090b]/80 backdrop-blur-xl flex items-center justify-between sticky top-0 z-40">
        <div>
          <div className="flex items-center gap-3">
             <h2 className="text-xl font-black text-zinc-100 tracking-tighter uppercase italic">{project.name}</h2>
             <div className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-black text-zinc-500 uppercase tracking-widest">Live Flow</div>
          </div>
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">
            {project.assets.length} Active References • {project.scenes.length} Scenes
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Active Assets Quick Preview */}
          <div className="flex items-center gap-1 mr-4 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900">
             <div className="flex -space-x-2">
                {project.assets.map(a => (
                  <div key={a.id} className="group/asset relative w-8 h-8 rounded-lg border-2 border-zinc-950 bg-zinc-800 overflow-hidden" title={a.type}>
                     <img src={a.public_url} alt="" className="w-full h-full object-cover" />
                     <button 
                        onClick={() => handleUnlink(a.id)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover/asset:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                     >
                        <X size={12} />
                     </button>
                  </div>
                ))}
             </div>
             <button 
                onClick={() => onNavigate('library')}
                className="w-8 h-8 rounded-lg border-2 border-dashed border-zinc-800 hover:border-zinc-500 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer ml-1"
                title="Manage References"
             >
                <Plus size={14} />
             </button>
          </div>

          <div className="w-px h-8 bg-zinc-900"></div>

          <button 
            onClick={handleExport}
            disabled={exporting || project.scenes.length === 0}
            className="flex items-center gap-2.5 bg-zinc-100 hover:bg-white text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition cursor-pointer disabled:opacity-30 shadow-xl shadow-black/40"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            {exporting ? 'Stitching' : 'Export'}
          </button>
        </div>
      </header>

      <div className="flex-grow flex flex-col overflow-hidden relative">
         <ChatFeed projectId={project.id} scenes={project.scenes} onRefresh={fetchProject} />
         
         <PromptInput 
            projectId={project.id} 
            nextOrder={project.scenes.length + 1} 
            onSceneCreated={fetchProject} 
            availableAssets={project.assets}
         />
      </div>
    </div>
  );
}
