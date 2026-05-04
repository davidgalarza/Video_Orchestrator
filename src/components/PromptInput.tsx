import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Image as ImageIcon, X, Video, Wand2 } from 'lucide-react';
import { createScene, generateAssets } from '../api';
import type { Asset } from '../api';
import { useNotification } from './Notification';

interface PromptInputProps {
  projectId: string;
  nextOrder: number;
  onSceneCreated: () => void;
  availableAssets: Asset[];
}

export function PromptInput({ projectId, nextOrder, onSceneCreated, availableAssets }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'VIDEO' | 'IMAGE'>('VIDEO');
  const [selectedStartFrameId, setSelectedStartFrameId] = useState<string | null>(null);
  const [selectedEndFrameId, setSelectedEndFrameId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'START' | 'END'>('START');
  const { showNotification } = useNotification();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      if (mode === 'VIDEO') {
        await createScene(projectId, nextOrder, prompt, selectedStartFrameId || undefined, selectedEndFrameId || undefined);
        setPrompt('');
        setSelectedStartFrameId(null);
        setSelectedEndFrameId(null);
        setShowPicker(false);
        onSceneCreated();
      } else {
        showNotification('Manifesting image...', 'loading');
        await generateAssets(prompt, 1);
        showNotification('Vision stored in Library', 'success');
        setPrompt('');
        onSceneCreated(); // Trigger refresh in parent
      }
    } catch (error: any) {
      console.error('Creative execution failed', error);
      showNotification(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectedStartAsset = availableAssets.find(a => a.id === selectedStartFrameId);
  const selectedEndAsset = availableAssets.find(a => a.id === selectedEndFrameId);

  return (
    <div className="sticky bottom-0 w-full p-6 pb-10 bg-gradient-to-t from-black via-black to-transparent pointer-events-none z-50">
      <div className="max-w-4xl mx-auto pointer-events-auto space-y-4">
        
        {/* Mode Toggle & Status */}
        <div className="flex items-center justify-between px-4">
           <div className="flex bg-zinc-900 border border-zinc-800 rounded-full p-1 shadow-xl">
              <button 
                onClick={() => setMode('VIDEO')}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition cursor-pointer ${mode === 'VIDEO' ? 'bg-zinc-100 text-black shadow-lg shadow-black/40' : 'text-zinc-600 hover:text-zinc-300'}`}
              >
                <Video size={12} />
                Video Flow
              </button>
              <button 
                onClick={() => setMode('IMAGE')}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition cursor-pointer ${mode === 'IMAGE' ? 'bg-zinc-100 text-black shadow-lg shadow-black/40' : 'text-zinc-600 hover:text-zinc-300'}`}
              >
                <Wand2 size={12} />
                Image Gen
              </button>
           </div>

           <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-3">
              <span className={mode === 'VIDEO' ? 'text-zinc-100' : ''}>Scene {nextOrder}</span>
              <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
              <span>Engine: {mode === 'VIDEO' ? 'Orchestration' : 'Manifestation'}</span>
           </div>
        </div>
        
        {/* Keyframe Selector UI */}
        {showPicker && mode === 'VIDEO' && (
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
             <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                   Select {pickerMode === 'START' ? 'Starting' : 'Target End'} Frame
                </span>
                <button onClick={() => { setShowPicker(false); }} className="text-zinc-600 hover:text-zinc-300 transition cursor-pointer">
                   <X size={14} />
                </button>
             </div>
             <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {availableAssets.map(asset => (
                  <button 
                    key={asset.id}
                    onClick={() => { 
                       if (pickerMode === 'START') setSelectedStartFrameId(asset.id);
                       else setSelectedEndFrameId(asset.id);
                       setShowPicker(false); 
                    }}
                    className={`
                      relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all
                      ${(pickerMode === 'START' ? selectedStartFrameId : selectedEndFrameId) === asset.id ? 'border-zinc-100 scale-95 shadow-lg shadow-black/40' : 'border-zinc-800 hover:border-zinc-600 opacity-60 hover:opacity-100'}
                    `}
                  >
                    <img src={asset.public_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
             </div>
          </div>
        )}

        <form 
          onSubmit={handleSubmit}
          className="relative group flex items-start bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 rounded-2xl p-2 shadow-2xl focus-within:border-zinc-500 transition-all duration-500 hover:border-zinc-700"
        >
          {mode === 'VIDEO' && (
            <div className="flex items-center gap-1 pl-1 pt-1">
               <button 
                 type="button"
                 onClick={() => { setPickerMode('START'); setShowPicker(true); }}
                 className={`relative w-10 h-10 rounded-xl border border-dashed transition-all flex items-center justify-center overflow-hidden cursor-pointer ${selectedStartAsset ? 'border-zinc-700' : 'border-zinc-800 hover:border-zinc-700 text-zinc-600'}`}
               >
                 {selectedStartAsset ? (
                   <img src={selectedStartAsset.public_url} className="w-full h-full object-cover" />
                 ) : (
                   <span className="text-[10px] font-black">S</span>
                 )}
                 <div className="absolute top-0 left-0 bg-black/60 px-1 text-[7px] font-black uppercase text-zinc-400">Start</div>
               </button>

               <button 
                 type="button"
                 onClick={() => { setPickerMode('END'); setShowPicker(true); }}
                 className={`relative w-10 h-10 rounded-xl border border-dashed transition-all flex items-center justify-center overflow-hidden cursor-pointer ${selectedEndAsset ? 'border-zinc-700' : 'border-zinc-800 hover:border-zinc-700 text-zinc-600'}`}
               >
                 {selectedEndAsset ? (
                   <img src={selectedEndAsset.public_url} className="w-full h-full object-cover" />
                 ) : (
                   <span className="text-[10px] font-black">E</span>
                 )}
                 <div className="absolute top-0 left-0 bg-black/60 px-1 text-[7px] font-black uppercase text-zinc-400">End</div>
               </button>
            </div>
          )}

          <div className={mode === 'IMAGE' ? 'pl-4 pt-4 text-zinc-500' : 'pt-4'}>
             {mode === 'IMAGE' && <Wand2 size={20} className="animate-pulse" />}
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'IMAGE' ? "Describe the asset to generate..." : (selectedStartAsset && selectedEndAsset ? "Describe the transition..." : "Describe the cinematic sequence...")}
            className="flex-grow bg-transparent border-none px-4 py-3 text-zinc-100 text-sm focus:outline-none placeholder:text-zinc-600 resize-none overflow-hidden"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="bg-zinc-100 hover:bg-white text-black p-3 rounded-xl disabled:opacity-30 disabled:hover:bg-zinc-100 transition-all flex items-center justify-center cursor-pointer shadow-lg mr-1 self-end mb-1"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>

          <div className="absolute -inset-0.5 bg-gradient-to-r from-zinc-500 to-zinc-900 rounded-2xl opacity-0 group-focus-within:opacity-10 transition duration-500 -z-10 blur"></div>
        </form>
        
      </div>
    </div>
  );
}
