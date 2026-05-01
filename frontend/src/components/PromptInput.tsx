import { useState } from 'react';
import { Send, Sparkles, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { createScene } from '../api';
import type { Asset } from '../api';

interface PromptInputProps {
  projectId: string;
  nextOrder: number;
  onSceneCreated: () => void;
  availableAssets: Asset[];
}

export function PromptInput({ projectId, nextOrder, onSceneCreated, availableAssets }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedStartFrameId, setSelectedStartFrameId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      await createScene(projectId, nextOrder, prompt, selectedStartFrameId || undefined);
      setPrompt('');
      setSelectedStartFrameId(null);
      setShowPicker(false);
      onSceneCreated();
    } catch (error) {
      console.error('Failed to create scene', error);
      alert('Failed to add scene');
    } finally {
      setLoading(false);
    }
  };

  const selectedAsset = availableAssets.find(a => a.id === selectedStartFrameId);

  return (
    <div className="sticky bottom-0 w-full p-6 pb-10 bg-gradient-to-t from-black via-black to-transparent pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto space-y-4">
        
        {/* Keyframe Selector UI */}
        {(showPicker || selectedStartFrameId) && (
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
             <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Select Starting Frame</span>
                <button onClick={() => { setShowPicker(false); setSelectedStartFrameId(null); }} className="text-zinc-600 hover:text-zinc-300 transition">
                   <X size={14} />
                </button>
             </div>
             <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {availableAssets.map(asset => (
                  <button 
                    key={asset.id}
                    onClick={() => { setSelectedStartFrameId(asset.id); setShowPicker(false); }}
                    className={`
                      relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all
                      ${selectedStartFrameId === asset.id ? 'border-zinc-100 scale-95 shadow-lg shadow-black/40' : 'border-zinc-800 hover:border-zinc-600 opacity-60 hover:opacity-100'}
                    `}
                  >
                    <img src={asset.public_url} alt="" className="w-full h-full object-cover" />
                    {selectedStartFrameId === asset.id && (
                      <div className="absolute inset-0 bg-zinc-100/10 flex items-center justify-center">
                         <div className="bg-zinc-100 text-black p-1 rounded-full"><ImageIcon size={10} /></div>
                      </div>
                    )}
                  </button>
                ))}
                {availableAssets.length === 0 && (
                  <p className="text-[10px] text-zinc-700 italic">No assets linked to this project. Add some from the Library.</p>
                )}
             </div>
          </div>
        )}

        <form 
          onSubmit={handleSubmit}
          className="relative group flex items-center bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 rounded-2xl p-1 shadow-2xl focus-within:border-zinc-500 transition-all duration-500 hover:border-zinc-700"
        >
          <button 
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className={`
              ml-2 p-3 rounded-xl transition-all cursor-pointer
              ${selectedStartFrameId ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
            `}
            title="Add Starting Frame"
          >
            {selectedAsset ? (
              <div className="w-6 h-6 rounded-md overflow-hidden">
                <img src={selectedAsset.public_url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <ImageIcon size={20} />
            )}
          </button>

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={selectedStartFrameId ? "Describe how to animate this frame..." : "Describe the next cinematic sequence..."}
            className="flex-grow bg-transparent border-none px-4 py-4 text-zinc-100 text-sm focus:outline-none placeholder:text-zinc-600"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="bg-zinc-100 hover:bg-white text-black p-3 rounded-xl disabled:opacity-30 disabled:hover:bg-zinc-100 transition-all flex items-center justify-center cursor-pointer shadow-lg mr-1"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>

          {/* Micro-animation highlight */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-zinc-500 to-zinc-900 rounded-2xl opacity-0 group-focus-within:opacity-10 transition duration-500 -z-10 blur"></div>
        </form>
        <p className="text-[10px] text-zinc-600 text-center mt-3 font-medium tracking-wide uppercase">
          Maintaining consistency across Scene {nextOrder} • Powered by Veo 3.1 Preview
        </p>
      </div>
    </div>
  );
}
