import { useState, useEffect } from 'react';
import { generateAssets, getGlobalAssets, deleteAsset } from '../api';
import type { Asset } from '../api';
import { 
  Sparkles, Loader2, Wand2, Grid, 
  Download, Plus, Check, ImageIcon,
  Trash2, ExternalLink
} from 'lucide-react';
import { useNotification } from '../components/Notification';

export function ImageGenView() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Asset[]>([]);
  const [history, setHistory] = useState<Asset[]>([]);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const assets = await getGlobalAssets();
      setHistory(assets.filter((a: Asset) => a.file_path.includes('gen_')).reverse());
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      const { assets } = await generateAssets(prompt, 1);
      setResults(assets);
      setHistory(prev => [...assets, ...prev]);
      showNotification('Vision manifested', 'success');
      setPrompt('');
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently destroy this manifestation? This cannot be undone.')) return;
    try {
      await deleteAsset(id);
      setHistory(prev => prev.filter(a => a.id !== id));
      setResults(prev => prev.filter(a => a.id !== id));
      showNotification('Asset destroyed', 'info');
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      <header className="px-10 py-12">
        <div className="flex items-center gap-3 mb-2">
           <Wand2 size={24} className="text-zinc-600" />
           <h2 className="text-4xl font-black text-zinc-100 tracking-tighter uppercase italic">Image Studio</h2>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto px-10 pb-20">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Main Input */}
          <form onSubmit={handleGenerate} className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-zinc-500 to-zinc-800 rounded-3xl opacity-20 blur group-focus-within:opacity-40 transition duration-1000"></div>
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-2 flex items-center shadow-2xl">
              <input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a character, product, or cinematic style..."
                className="flex-grow bg-transparent border-none px-6 py-6 text-zinc-100 text-lg focus:outline-none placeholder:text-zinc-700"
                disabled={loading}
              />
              <button 
                type="submit"
                disabled={!prompt.trim() || loading}
                className="bg-zinc-100 hover:bg-white text-black px-10 py-6 rounded-2xl flex items-center gap-3 transition font-black uppercase tracking-widest text-xs shadow-xl shadow-black/40 disabled:opacity-30 cursor-pointer"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Manifesting' : 'Conceive'}
              </button>
            </div>
          </form>

          {/* Results Grid */}
          <div className={results.length === 1 ? "max-w-2xl mx-auto" : "grid grid-cols-2 gap-8"}>
            {results.map((asset) => (
              <div 
                key={asset.id} 
                className="group relative bg-zinc-900/40 border border-zinc-900 rounded-3xl overflow-hidden aspect-square shadow-2xl animate-in zoom-in-95 duration-700"
              >
                <img src={asset.public_url} alt="" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex items-end justify-between">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-zinc-400">Latest Manifestation</p>
                      <p className="text-[9px] font-bold text-zinc-600 font-mono uppercase tracking-tighter">{asset.id}</p>
                   </div>
                   <button 
                    onClick={() => handleDelete(asset.id)}
                    className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-3 rounded-xl transition shadow-xl cursor-pointer"
                   >
                      <Trash2 size={16} />
                   </button>
                </div>
              </div>
            ))}
          </div>

          {/* History Gallery */}
          {history.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                 <div className="flex items-center gap-3">
                    <Grid size={18} className="text-zinc-600" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-100">Manifestation Gallery</h3>
                 </div>
                 <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{history.length} Assets</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                 {history.map((asset) => (
                    <div 
                      key={asset.id} 
                      className="group relative bg-zinc-900/20 border border-zinc-900/50 rounded-2xl overflow-hidden aspect-square hover:border-zinc-700 transition duration-500"
                    >
                       <img src={asset.public_url} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-500" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleDelete(asset.id)}
                            className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition cursor-pointer shadow-lg" title="Destroy Manifestation"
                          >
                             <Trash2 size={14} />
                          </button>
                          <a 
                            href={asset.public_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer shadow-lg" title="Open Original"
                          >
                             <ExternalLink size={14} />
                          </a>
                       </div>
                    </div>
                 ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
