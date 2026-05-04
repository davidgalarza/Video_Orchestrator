import { useEffect, useState, useCallback } from 'react';
import { getAllScenesWithVideos, deleteScene, type Scene } from '../db';
import { Video, Play, Trash2, Download, Film, Calendar } from 'lucide-react';
import { useNotification } from '../components/Notification';
import { downloadBlob } from '../ffmpeg';

export function VideoLibraryView() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const { showNotification, hideNotification } = useNotification();

  const fetchVideos = useCallback(async () => {
    try {
      const data = await getAllScenesWithVideos();
      setScenes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video permanently?')) return;
    
    const tid = showNotification('Deleting video...', 'loading');
    try {
      await deleteScene(id);
      hideNotification(tid);
      showNotification('Video deleted', 'success');
      fetchVideos();
    } catch (err: unknown) {
      hideNotification(tid);
      const message = err instanceof Error ? err.message : 'Delete failed';
      showNotification(message, 'error');
    }
  };

  const handleDownload = (scene: Scene) => {
    if (scene.video_blob) {
      downloadBlob(scene.video_blob, `scene_${scene.id}.mp4`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Film className="animate-spin text-zinc-700" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Video size={28} className="text-zinc-100" />
            <h1 className="text-3xl font-black tracking-tighter text-zinc-100">Video Library</h1>
          </div>
          <p className="text-zinc-500 text-sm">
            {scenes.length} {scenes.length === 1 ? 'video' : 'videos'} generated
          </p>
        </header>

        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl">
            <Film size={64} className="text-zinc-800 mb-4" />
            <p className="text-zinc-600 text-sm font-bold uppercase tracking-widest mb-2">No videos yet</p>
            <p className="text-zinc-700 text-xs">Generate videos from your flows to see them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className="group bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all duration-300"
              >
                {/* Video Preview */}
                <div className="aspect-video bg-black relative overflow-hidden">
                  {playingVideo === scene.id ? (
                    <video
                      src={scene.video_url}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                      onEnded={() => setPlayingVideo(null)}
                    />
                  ) : (
                    <>
                      {scene.video_url ? (
                        <video
                          src={scene.video_url}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                          <Film size={32} className="text-zinc-800" />
                        </div>
                      )}
                      {/* Play Overlay */}
                      <button
                        onClick={() => setPlayingVideo(scene.id)}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                          <Play size={24} className="text-black ml-1" />
                        </div>
                      </button>
                    </>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-zinc-300 text-sm font-medium line-clamp-2 mb-3">
                    {scene.prompt || 'Untitled Scene'}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-zinc-600">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(scene.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownload(scene)}
                        className="p-2 hover:bg-zinc-900 rounded-lg transition text-zinc-500 hover:text-zinc-300"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(scene.id)}
                        className="p-2 hover:bg-zinc-900 rounded-lg transition text-zinc-500 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
