import { triggerGeneration } from '../api';
import type { Scene } from '../api';
import { Play, Loader2, Sparkles, AlertCircle, RefreshCw, Download, Copy } from 'lucide-react';
import { useState } from 'react';
import { useNotification } from './Notification';

interface MessageBubbleProps {
  scene: Scene;
  projectId: string;
  onRefresh: () => void;
}

export function MessageBubble({ scene, projectId, onRefresh }: MessageBubbleProps) {
  const { showNotification, hideNotification } = useNotification();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const toastId = showNotification('Igniting Veo 3.1 engines...', 'loading');
    try {
      await triggerGeneration(projectId, scene.id);
      hideNotification(toastId);
      showNotification('Generation sequence initiated!', 'success');
      onRefresh();
    } catch (error: any) {
      console.error('Generation trigger failed', error);
      hideNotification(toastId);
      showNotification(error.message || 'Engine failure', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(scene.prompt);
    showNotification('Prompt copied to clipboard', 'success');
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto px-4 py-6">
      {/* User Message (Prompt) */}
      <div className="flex justify-end w-full animate-in slide-in-from-right-4 duration-300">
        <div className="group relative max-w-[80%] bg-zinc-100 text-black px-4 py-3 rounded-2xl rounded-tr-none shadow-lg">
          <p className="text-sm font-medium leading-relaxed">{scene.prompt}</p>
          <div className="mt-2 flex justify-between items-center">
            <button 
              onClick={handleCopyPrompt}
              className="p-1 rounded-md hover:bg-black/5 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer text-zinc-500"
              title="Copy Prompt"
            >
              <Copy size={12} />
            </button>
            <span className="text-[10px] opacity-50 font-bold uppercase tracking-tighter">Scene {scene.order}</span>
          </div>
        </div>
      </div>

      {/* AI Response (Video/Status) */}
      <div className="flex justify-start w-full animate-in slide-in-from-left-4 duration-500 delay-150">
        <div className="w-full max-w-[85%] bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl transition-all hover:border-zinc-700">
          {scene.status === 'completed' && scene.public_url ? (
            <div className="relative group">
              <video 
                src={scene.public_url} 
                controls 
                className="w-full h-auto aspect-video object-cover"
                poster="/video-placeholder.png"
              />
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                <Sparkles size={14} className="text-yellow-400" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Generated with Veo 3.1</span>
              </div>
              <button 
                onClick={() => window.open(scene.public_url!, '_blank')}
                className="absolute top-4 right-4 p-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-100 hover:text-black cursor-pointer shadow-xl"
              >
                <Download size={16} />
              </button>
            </div>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center p-8 bg-zinc-950/40">
              {scene.status === 'processing' ? (
                <>
                  <div className="relative mb-4">
                    <Loader2 className="animate-spin text-zinc-400" size={48} />
                    <Sparkles className="absolute -top-1 -right-1 text-zinc-100 animate-pulse" size={16} />
                  </div>
                  <h4 className="text-zinc-100 font-semibold mb-1">Painting your vision...</h4>
                  <p className="text-zinc-500 text-xs text-center max-w-[200px]">Veo is generating your cinematic sequence. This usually takes 1-2 minutes.</p>
                </>
              ) : scene.status === 'failed' ? (
                <>
                  <AlertCircle className="text-red-500 mb-4" size={48} />
                  <h4 className="text-zinc-100 font-semibold mb-1">Generation Stalled</h4>
                  <p className="text-zinc-500 text-xs mb-6">Something went wrong while processing the scene.</p>
                  <button 
                    onClick={handleGenerate}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 text-black text-sm font-bold hover:bg-white transition cursor-pointer"
                  >
                    <RefreshCw size={16} />
                    Retry Scene
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition duration-500">
                    <Play className="text-zinc-100 ml-1" size={32} />
                  </div>
                  <button 
                    disabled={isGenerating}
                    onClick={handleGenerate}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-100 text-black text-sm font-black uppercase tracking-widest hover:bg-white hover:scale-105 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-xl shadow-zinc-950/20"
                  >
                    {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    Generate Video
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
