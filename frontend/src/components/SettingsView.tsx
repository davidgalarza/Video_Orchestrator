import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api';
import type { GlobalSettings } from '../api';
import { 
  Settings as SettingsIcon, Save, Loader2, 
  Monitor, Smartphone, Sparkles, Cpu, 
  Quote, Type
} from 'lucide-react';
import { useNotification } from '../components/Notification';

export function SettingsView() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings);
      showNotification('Global settings synchronized', 'success');
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-zinc-800" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#09090b] overflow-y-auto">
      <header className="px-10 py-12">
        <div className="flex items-center gap-3 mb-2">
           <SettingsIcon size={24} className="text-zinc-600" />
           <h2 className="text-4xl font-black text-zinc-100 tracking-tighter uppercase italic">Studio Settings</h2>
        </div>
        <p className="text-zinc-500 text-sm font-medium">Configure your global orchestration engine and default styles.</p>
      </header>

      <form onSubmit={handleSave} className="px-10 pb-20 max-w-4xl space-y-12">
        {/* Model Configuration */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-zinc-100 border-b border-zinc-900 pb-4">
             <Cpu size={18} className="text-zinc-600" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em]">Engine Configuration</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-8">
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block">Aspect Ratio</label>
                <div className="flex gap-4">
                   <button 
                     type="button"
                     onClick={() => setSettings({...settings, aspect_ratio: '16:9'})}
                     className={`flex-grow flex items-center justify-center gap-3 py-3 rounded-xl border transition cursor-pointer ${settings.aspect_ratio === '16:9' ? 'bg-zinc-100 border-zinc-100 text-black shadow-xl shadow-black/20' : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-700'}`}
                   >
                      <Monitor size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Cinema (16:9)</span>
                   </button>
                   <button 
                     type="button"
                     onClick={() => setSettings({...settings, aspect_ratio: '9:16'})}
                     className={`flex-grow flex items-center justify-center gap-3 py-3 rounded-xl border transition cursor-pointer ${settings.aspect_ratio === '9:16' ? 'bg-zinc-100 border-zinc-100 text-black shadow-xl shadow-black/20' : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-700'}`}
                   >
                      <Smartphone size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Mobile (9:16)</span>
                   </button>
                </div>
             </div>
          </div>
        </section>

        {/* Global Styling */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-zinc-100 border-b border-zinc-900 pb-4">
             <Type size={18} className="text-zinc-600" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em]">Global Orchestration Prompt</h3>
          </div>
          
          <div className="space-y-8">
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block flex items-center gap-2">
                   <Quote size={10} />
                   Prompt Prefix
                </label>
                <input 
                  type="text"
                  value={settings.global_prompt_prefix}
                  onChange={(e) => setSettings({...settings, global_prompt_prefix: e.target.value})}
                  placeholder="e.g. A high-budget cinematic shot of..."
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-xs font-bold text-zinc-300 focus:outline-none focus:border-zinc-700 transition"
                />
             </div>

             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block flex items-center gap-2">
                   <Quote size={10} />
                   Prompt Suffix (Recommended for Style)
                </label>
                <textarea 
                  rows={4}
                  value={settings.global_prompt_suffix}
                  onChange={(e) => setSettings({...settings, global_prompt_suffix: e.target.value})}
                  placeholder="e.g. cinematic lighting, 8k, photorealistic, highly detailed"
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-xs font-bold text-zinc-300 focus:outline-none focus:border-zinc-700 transition resize-none"
                />
             </div>
          </div>
          
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6 flex items-start gap-4">
             <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                <Sparkles size={16} />
             </div>
             <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest mb-1">PRO TIP</h4>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Settings here are **Studio-wide**. Your chosen Aspect Ratio will be applied to both new AI-generated images and video scenes to ensure a unified cinematic layout.
                </p>
             </div>
          </div>
        </section>

        <div className="pt-8 flex justify-end">
           <button 
             type="submit"
             disabled={saving}
             className="bg-zinc-100 hover:bg-white text-black rounded-xl px-12 py-4 flex items-center gap-3 transition font-black cursor-pointer text-xs uppercase tracking-[0.2em] shadow-2xl shadow-black/40 disabled:opacity-50"
           >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Configuration
           </button>
        </div>
      </form>
    </div>
  );
}
