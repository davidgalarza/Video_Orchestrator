import { useEffect, useState, useCallback } from 'react';
import { getSettings, updateSettings, type GlobalSettings } from '../api';
import { 
  Settings as SettingsIcon, Save, Loader2, 
  Monitor, Smartphone, Sparkles, Cpu, 
  Quote, Type, Key, Eye, EyeOff, Check, AlertTriangle
} from 'lucide-react';
import { useNotification } from '../components/Notification';
import { getApiKey, setApiKey } from '../store/settings';

export function SettingsView() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKeyState] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const { showNotification } = useNotification();

  const fetchSettings = useCallback(async () => {
    try {
      const data = getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    // Load existing API key (masked)
    const existingKey = getApiKey();
    if (existingKey) {
      setApiKeyState(existingKey);
      setKeyValid(true);
    }
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      updateSettings(settings);
      showNotification('Global settings saved', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      showNotification(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      showNotification('Please enter an API key', 'error');
      return;
    }
    setApiKey(apiKey.trim());
    setKeyValid(true);
    showNotification('API key saved to browser storage', 'success');
  };

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      showNotification('Please enter an API key first', 'error');
      return;
    }
    
    try {
      showNotification('Testing API key...', 'loading');
      const { GoogleGenAI } = await import('@google/genai');
      const client = new GoogleGenAI({ apiKey: apiKey.trim() });
      
      // Make a simple test request
      await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'Hello',
      });
      
      setKeyValid(true);
      showNotification('API key is valid!', 'success');
    } catch (err: unknown) {
      setKeyValid(false);
      
      // Dynamic error message extraction
      let message = 'Test failed';
      
      if (err instanceof Error) {
        message = err.message;
        
        // Try to parse JSON error messages from API
        try {
          // Check if the message contains JSON
          const jsonMatch = message.match(/\{.*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // Extract meaningful error details
            message = parsed.error?.message || 
                      parsed.message || 
                      parsed.error?.details?.[0]?.message ||
                      message;
          }
        } catch {
          // Not JSON, use original message
        }
        
        // Map common API errors to user-friendly messages
        if (message.includes('API key not valid')) {
          message = 'Invalid API key. Please check your Google API key.';
        } else if (message.includes('quota')) {
          message = 'API quota exceeded. Check your Google Cloud billing.';
        } else if (message.includes('403') || message.includes('permission')) {
          message = 'Access denied. Ensure Generative Language API is enabled.';
        } else if (message.includes('404')) {
          message = 'API endpoint not found. Check your API key configuration.';
        } else if (message.includes('429')) {
          message = 'Too many requests. Please try again later.';
        } else if (message.includes('500') || message.includes('internal')) {
          message = 'Google API service error. Please try again later.';
        } else if (message.includes('network') || message.includes('fetch')) {
          message = 'Network error. Check your internet connection.';
        }
      }
      
      showNotification(`API key test failed: ${message}`, 'error');
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

        {/* API Key Configuration */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-zinc-100 border-b border-zinc-900 pb-4">
             <Key size={18} className="text-zinc-600" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em]">Google API Key</h3>
          </div>
          
          <div className="space-y-4">
             <p className="text-[11px] text-zinc-500 leading-relaxed">
                Your API key is stored locally in your browser and is never sent to our servers. 
                You need a <a href="https://ai.google.dev/" target="_blank" className="text-zinc-300 underline hover:text-white">Google AI API key</a> to generate videos and images.
             </p>
             
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 block">
                  API Key
                  {keyValid === true && <span className="ml-2 text-emerald-500 flex items-center gap-1 inline-flex"><Check size={10} /> Valid</span>}
                  {keyValid === false && <span className="ml-2 text-red-500 flex items-center gap-1 inline-flex"><AlertTriangle size={10} /> Invalid</span>}
                </label>
                <div className="flex gap-2">
                   <div className="relative flex-grow">
                      <input 
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKeyState(e.target.value)}
                        placeholder="Enter your Google API key..."
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-xs font-bold text-zinc-300 focus:outline-none focus:border-zinc-700 transition pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                   </div>
                   <button 
                     type="button"
                     onClick={handleSaveApiKey}
                     className="bg-zinc-900 hover:bg-zinc-800 text-zinc-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition border border-zinc-800"
                   >
                     Save Key
                   </button>
                   <button 
                     type="button"
                     onClick={handleTestApiKey}
                     className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition border border-zinc-800"
                   >
                     Test
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
