import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, createProject, deleteProject } from '../api';
import type { Project } from '../api';
import { Plus, Folder, Video, Trash2, Sparkles } from 'lucide-react';
import { useNotification } from '../components/Notification';

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const { showNotification } = useNotification();

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const project = await createProject(newProjectName);
      setProjects([...projects, project]);
      setNewProjectName('');
      showNotification(`Flow "${project.name}" created!`, 'success');
    } catch (error: unknown) {
      console.error('Failed to create project', error);
      const message = error instanceof Error ? error.message : 'Failed to create flow';
      showNotification(message, 'error');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteProject(id);
      setProjects(projects.filter((p) => p.id !== id));
      showNotification('Flow deleted', 'info');
    } catch (error: unknown) {
      console.error('Failed to delete project', error);
      const message = error instanceof Error ? error.message : 'Failed to delete flow';
      showNotification(message, 'error');
    }
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-zinc-100 mb-1">My Flows</h2>
          <p className="text-zinc-500 text-sm font-medium">Powered by Veo 3.1 & Google AI</p>
        </div>
        <form onSubmit={handleCreateProject} className="flex gap-3">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="New flow name..."
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-700 text-sm min-w-[250px] transition-all"
          />
          <button
            type="submit"
            className="bg-zinc-100 hover:bg-white text-black rounded-xl px-6 py-3 flex items-center gap-2 transition font-bold cursor-pointer text-sm shadow-xl shadow-zinc-950/20"
          >
            <Plus size={18} />
            Create
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-zinc-600 font-medium">Loading your universe...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project: any) => (
            <Link
              key={project.id}
              to={`/project/${project.id}`}
              className="group bg-zinc-900/40 backdrop-blur-md border border-zinc-900 rounded-3xl p-8 hover:border-zinc-700 transition-all duration-500 relative cursor-pointer overflow-hidden shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-zinc-800 rounded-2xl text-zinc-100 group-hover:bg-zinc-100 group-hover:text-black transition-all duration-500 shadow-lg">
                  <Folder size={28} />
                </div>
                <div className="flex flex-col items-end gap-2">
                   <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer md:opacity-0 md:group-hover:opacity-100"
                    title="Delete Project"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4 tracking-tight group-hover:text-zinc-100 transition-colors">{project.name}</h3>
              <div className="flex items-center gap-4 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1.5">
                  <Video size={14} />
                  {project.scenes.length} Scenes
                </span>
                <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
                <span className="flex items-center gap-1.5">
                   <Sparkles size={14} />
                   Veo
                </span>
              </div>
              
              {/* Subtle gradient background on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
            </Link>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full text-center py-24 bg-zinc-950/20 border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-600 font-medium">
              Your storyboard is empty. Create your first flow to begin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
