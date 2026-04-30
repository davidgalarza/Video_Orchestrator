import { useState } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { createScene } from '../api';

interface PromptInputProps {
  projectId: string;
  nextOrder: number;
  onSceneCreated: () => void;
}

export function PromptInput({ projectId, nextOrder, onSceneCreated }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      await createScene(projectId, nextOrder, prompt);
      setPrompt('');
      onSceneCreated();
    } catch (error) {
      console.error('Failed to create scene', error);
      alert('Failed to add scene');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sticky bottom-0 w-full p-6 pb-10 bg-gradient-to-t from-black via-black to-transparent pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        <form 
          onSubmit={handleSubmit}
          className="relative group flex items-center bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 rounded-2xl p-1 shadow-2xl focus-within:border-zinc-500 transition-all duration-500 hover:border-zinc-700"
        >
          <div className="pl-4 text-zinc-500">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the next cinematic sequence..."
            className="flex-grow bg-transparent border-none px-4 py-4 text-zinc-100 text-sm focus:outline-none placeholder:text-zinc-600"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="bg-zinc-100 hover:bg-white text-black p-3 rounded-xl disabled:opacity-30 disabled:hover:bg-zinc-100 transition-all flex items-center justify-center cursor-pointer shadow-lg"
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
