import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, exportProject } from '../api';
import type { Project, Asset } from '../api';
import { AssetTray } from '../components/AssetTray';
import { ChatFeed } from '../components/ChatFeed';
import { PromptInput } from '../components/PromptInput';
import { ArrowLeft, Settings, Share2, Info, Loader2, Sparkles } from 'lucide-react';
import { useNotification } from '../components/Notification';

export function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getProject(id);
      setProject(data);
    } catch (err) {
      console.error('Failed to fetch project', err);
      setError('Could not load project details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    const hasProcessing = project?.scenes.some(s => s.status === 'processing');
    if (hasProcessing) {
      const interval = setInterval(fetchProject, 5000);
      return () => clearInterval(interval);
    }
  }, [project?.scenes, fetchProject]);

  const handleAssetUploaded = (newAsset: Asset) => {
    if (project) {
      setProject({
        ...project,
        assets: [...project.assets, newAsset]
      });
    }
  };

  const { showNotification, hideNotification } = useNotification();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    const toastId = showNotification('Stitching scenes together...', 'loading');
    try {
      const { export_url } = await exportProject(project.id);
      hideNotification(toastId);
      showNotification('Master video ready!', 'success');
      window.open(export_url, '_blank');
    } catch (err: any) {
      console.error('Export failed', err);
      hideNotification(toastId);
      showNotification(err.message || 'Stitching failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-zinc-500" size={40} />
          <p className="text-zinc-500 text-sm font-medium animate-pulse">Entering Flow...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Oops!</h2>
        <p className="text-zinc-500 mb-6">{error || 'Project not found'}</p>
        <Link to="/" className="text-zinc-100 hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden selection:bg-zinc-100 selection:text-black">
      <AssetTray 
        projectId={project.id} 
        assets={project.assets} 
        onAssetUploaded={handleAssetUploaded} 
      />

      <div className="flex-grow flex flex-col relative h-full">
        <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-zinc-900 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link 
              to="/" 
              className="p-2.5 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-zinc-100 transition cursor-pointer"
              title="Back to Flows"
            >
              <ArrowLeft size={22} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-zinc-100 leading-tight tracking-tighter">{project.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Sparkles size={12} className="text-zinc-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Google Veo 3.1 Flow</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button className="p-2.5 text-zinc-600 hover:text-zinc-100 transition cursor-pointer" title="Settings">
                <Settings size={22} />
             </button>
             <button className="p-2.5 text-zinc-600 hover:text-zinc-100 transition cursor-pointer" title="Info">
                <Info size={22} />
             </button>
             <div className="w-px h-8 bg-zinc-900 mx-2"></div>
             <button 
                onClick={handleExport}
                disabled={exporting || project.scenes.length === 0}
                className="flex items-center gap-2.5 bg-zinc-100 hover:bg-white text-black px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition cursor-pointer shadow-xl shadow-zinc-950/40 disabled:opacity-50"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                {exporting ? 'Stitching...' : 'Export'}
             </button>
          </div>
        </header>

        <ChatFeed 
          projectId={project.id} 
          scenes={project.scenes} 
          onRefresh={fetchProject} 
        />

        <PromptInput 
          projectId={project.id} 
          nextOrder={project.scenes.length + 1} 
          onSceneCreated={fetchProject} 
        />
      </div>
    </div>
  );
}
