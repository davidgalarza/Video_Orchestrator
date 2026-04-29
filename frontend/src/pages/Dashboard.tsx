import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, createProject } from '../api';
import type { Project } from '../api';
import { Plus, Folder, Video } from 'lucide-react';

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const project = await createProject(newProjectName);
      setProjects([...projects, project]);
      setNewProjectName('');
    } catch (error) {
      console.error('Failed to create project', error);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold">My Flows</h2>
        <form onSubmit={handleCreateProject} className="flex gap-2">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name..."
            className="bg-slate-900 border border-slate-700 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 flex items-center gap-2 transition"
          >
            <Plus size={20} />
            Create
          </button>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-20">Loading projects...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/project/${project.id}`}
              className="group bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500/20 transition">
                  <Folder size={24} />
                </div>
                <div className="text-slate-500 text-sm">
                  {new Date(project.created_at).toLocaleDateString()}
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
              <div className="flex items-center gap-4 text-slate-400 text-sm">
                <span className="flex items-center gap-1">
                  <Video size={16} />
                  {project.scenes.length} Scenes
                </span>
              </div>
            </Link>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full text-center py-20 bg-slate-900/50 border border-dashed border-slate-800 rounded-xl text-slate-500">
              No projects yet. Create one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
