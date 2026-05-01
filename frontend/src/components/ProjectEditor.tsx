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
import { AssetTray } from './AssetTray';

export function ProjectEditor({ projectId, onNavigate }: { projectId: string, onNavigate: (v: 'library' | 'settings' | 'imagegen') => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [trayRefreshKey, setTrayRefreshKey] = useState(0);
  const { showNotification, hideNotification } = useNotification();

  const fetchProject = useCallback(async () => {
    try {
      const data = await getProject(projectId);
      setProject(data);
      setTrayRefreshKey(k => k + 1);
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
          <div className="hidden md:flex flex-col items-end mr-4">
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active References</span>
             <span className="text-xs font-bold text-zinc-100 italic">{project.assets.length} Assets Linked</span>
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
         <AssetTray project={project} onRefresh={fetchProject} refreshKey={trayRefreshKey} />
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
