import { useEffect, useState, useCallback } from 'react';
import { getProject, exportProject, unlinkAssetFromProject } from '../api';
import type { Project, Asset } from '../api';
import { ChatFeed } from '../components/ChatFeed';
import { PromptInput } from '../components/PromptInput';
import { 
  Settings, Share2, Info, Loader2, Sparkles, 
  Layers, Package, ExternalLink, Plus, X, Download
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

  const handleDownloadLatest = () => {
    if (!project) return;
    const completed = [...project.scenes].filter(s => s.status === 'completed').sort((a, b) => b.order - a.order);
    if (completed.length === 0) {
      showNotification('No completed videos to download', 'error');
      return;
    }
    const latest = completed[0];
    if (latest.public_url) {
      window.open(latest.public_url, '_blank');
    }
  };

  if (loading || !project) {
    return (
      <div className="flex-grow flex items-center justify-center bg-black">
         <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-zinc-700" size={40} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800 animate-pulse">Initializing Flow</span>
         </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col bg-black h-full overflow-hidden">
      {/* Dynamic Header */}
      <header className="flex items-center justify-between px-10 py-6 border-b border-zinc-900 bg-zinc-950/20 backdrop-blur-xl z-50">
        <div className="flex items-center gap-6">
           <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-white mb-1 uppercase italic">{project.name}</h1>
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   Orchestration Suite
                 </span>
                 <span className="text-zinc-800 text-[10px]">/</span>
                 <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{project.scenes.length} Sequence Manifests</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={handleDownloadLatest}
             className="bg-zinc-900 hover:bg-zinc-800 text-zinc-100 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 cursor-pointer border border-zinc-800"
           >
             <Download size={12} />
             Single Clip
           </button>
           <button 
             onClick={handleExport}
             disabled={exporting}
             className="bg-zinc-100 hover:bg-white text-black px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
           >
             {exporting ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />}
             Stitch Export
           </button>
        </div>
      </header>

      <div className="flex-grow flex overflow-hidden">
         {/* Left Side: Chat & Input */}
         <div className="flex-grow flex flex-col relative border-r border-zinc-900">
            <ChatFeed projectId={project.id} scenes={project.scenes} onRefresh={fetchProject} />
            <PromptInput 
               projectId={project.id} 
               nextOrder={project.scenes.length + 1} 
               onSceneCreated={fetchProject} 
               availableAssets={project.assets}
            />
         </div>

         {/* Right Side: Global Asset Library Sidebar */}
         <aside className="w-40 flex-shrink-0 bg-zinc-950/50 backdrop-blur-xl">
            <AssetTray project={project} onRefresh={fetchProject} refreshKey={trayRefreshKey} />
         </aside>
      </div>
    </div>
  );
}
