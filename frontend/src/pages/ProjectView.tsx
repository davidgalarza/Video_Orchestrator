import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, uploadAsset, createScene, triggerGeneration, getSceneStatus } from '../api';
import type { Project, Scene } from '../api';
import { ArrowLeft, Plus, Image as ImageIcon, Video, Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState<string | null>(null); // Stores the type being uploaded
  const [newScenePrompt, setNewScenePrompt] = useState('');

  useEffect(() => {
    if (id) fetchProjectData();
  }, [id]);

  const fetchProjectData = async () => {
    try {
      const data = await getProject(id!);
      setProject(data);
    } catch (error) {
      console.error('Failed to fetch project', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAsset = async (type: string, file: File) => {
    setIsUploading(type);
    try {
      await uploadAsset(id!, type, file);
      await fetchProjectData();
    } catch (error) {
      console.error('Failed to upload asset', error);
    } finally {
      setIsUploading(null);
    }
  };

  const handleAddScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenePrompt.trim()) return;
    try {
      const order = (project?.scenes.length || 0) + 1;
      await createScene(id!, order, newScenePrompt);
      setNewScenePrompt('');
      fetchProjectData();
    } catch (error) {
      console.error('Failed to add scene', error);
    }
  };

  const handleGenerate = async (sceneId: string) => {
    try {
      await triggerGeneration(id!, sceneId);
      fetchProjectData();
    } catch (error) {
      console.error('Failed to trigger generation', error);
    }
  };

  const checkStatus = async (sceneId: string) => {
    try {
      await getSceneStatus(id!, sceneId);
      fetchProjectData();
    } catch (error) {
      console.error('Failed to check status', error);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading project...</div>;
  if (!project) return <div className="p-8 text-center text-red-500">Project not found</div>;

  return (
    <div className="flex h-[calc(100-64px)] overflow-hidden">
      {/* Sidebar: Assets */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-2">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
        
        <div>
          <h3 className="text-lg font-semibold mb-4">Project Assets</h3>
          <div className="space-y-4">
            {['CHARACTER', 'PRODUCT', 'STYLE'].map((type) => (
              <div key={type} className="space-y-2">
                <label className="text-xs font-bold text-slate-500 tracking-wider uppercase">{type}</label>
                <div className="relative group">
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={isUploading !== null}
                    onChange={(e) => e.target.files?.[0] && handleUploadAsset(type, e.target.files[0])}
                  />
                  <div className={`bg-slate-800 border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition ${isUploading === type ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700 group-hover:border-slate-500'}`}>
                    {isUploading === type ? (
                      <Loader2 className="text-blue-500 animate-spin" />
                    ) : (
                      <ImageIcon className="text-slate-500" />
                    )}
                    <span className="text-sm text-slate-400">
                      {isUploading === type ? 'Uploading...' : `Upload ${type}`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.assets.filter(a => a.type === type).map(asset => (
                    <div key={asset.id} className="w-16 h-16 bg-slate-800 rounded border border-slate-700 overflow-hidden group/img relative">
                       <img src={asset.public_url} alt={type} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Canvas: Scenes */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          <header className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{project.name}</h2>
            <div className="text-slate-500 text-sm">System Prompt: {project.system_prompt || 'Standard Cinematic'}</div>
          </header>

          <div className="space-y-4">
            {project.scenes.sort((a, b) => a.order - b.order).map((scene) => (
              <div key={scene.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-6 flex gap-6">
                  <div className="w-12 h-12 flex-shrink-0 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-500 border border-slate-700">
                    {scene.order}
                  </div>
                  <div className="flex-1 space-y-4">
                    <p className="text-lg text-slate-200">{scene.prompt}</p>
                    <div className="flex items-center gap-4">
                      {scene.status === 'pending' && (
                        <button 
                          onClick={() => handleGenerate(scene.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm transition"
                        >
                          <Play size={16} />
                          Generate Video
                        </button>
                      )}
                      {scene.status === 'processing' && (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-blue-400 text-sm">
                            <Loader2 size={16} className="animate-spin" />
                            Veo is generating...
                          </div>
                          <button 
                            onClick={() => checkStatus(scene.id)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition"
                          >
                            Check Status
                          </button>
                        </div>
                      )}
                      {scene.status === 'completed' && (
                        <div className="flex items-center gap-2 text-green-500 text-sm">
                          <CheckCircle2 size={16} />
                          Ready
                        </div>
                      )}
                      {scene.status === 'failed' && (
                        <div className="flex items-center gap-2 text-red-500 text-sm">
                          <AlertCircle size={16} />
                          Failed
                        </div>
                      )}
                    </div>
                  </div>
                  {scene.public_url && (
                    <div className="w-64 aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 relative group">
                      <video 
                        src={scene.public_url} 
                        controls 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <form onSubmit={handleAddScene} className="bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-xl p-6">
              <div className="flex gap-4">
                <textarea
                  value={newScenePrompt}
                  onChange={(e) => setNewScenePrompt(e.target.value)}
                  placeholder="Describe the action in this scene..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded-md px-6 py-2 flex items-center gap-2 transition"
                >
                  <Plus size={20} />
                  Add Scene
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
