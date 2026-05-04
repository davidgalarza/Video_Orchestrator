import { useEffect, useState } from 'react';
import { getUsageSummary } from '../api';
import { 
  BarChart3, TrendingUp, Zap, Image as ImageIcon, 
  Video, DollarSign, Activity, Calendar,
  ArrowUpRight, Target
} from 'lucide-react';

export function UsageView() {
  const [summary, setSummary] = useState({
    total_tokens: 0,
    total_cost: 0,
    image_count: 0,
    video_count: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const data = await getUsageSummary();
      setSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { 
      label: 'Total Orchestrations', 
      value: summary.image_count + summary.video_count, 
      icon: Activity, 
      color: 'text-zinc-100',
      bg: 'bg-zinc-900'
    },
    { 
      label: 'Token Consumption', 
      value: summary.total_tokens.toLocaleString(), 
      icon: Zap, 
      color: 'text-zinc-100',
      bg: 'bg-zinc-900'
    },
    { 
      label: 'Estimated Cost', 
      value: `$${summary.total_cost.toFixed(2)}`, 
      icon: DollarSign, 
      color: 'text-zinc-100',
      bg: 'bg-zinc-100/10'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      <header className="px-10 py-12">
        <div className="flex items-center gap-3 mb-2">
           <BarChart3 size={24} className="text-zinc-600" />
           <h2 className="text-4xl font-black text-zinc-100 tracking-tighter uppercase italic">Usage & Billing</h2>
        </div>
        <p className="text-zinc-500 text-sm font-medium">Real-time insights into your studio's generative intelligence consumption.</p>
      </header>

      <div className="flex-grow overflow-y-auto px-10 pb-20">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, i) => (
              <div 
                key={stat.label} 
                className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden group hover:border-zinc-700 transition duration-500"
              >
                <div className={`${stat.bg} w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color} shadow-lg transition duration-500 group-hover:scale-110`}>
                  <stat.icon size={24} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">{stat.label}</div>
                  <div className="text-3xl font-black text-zinc-100 tracking-tighter uppercase italic">{stat.value}</div>
                </div>
                <div className="absolute top-8 right-8 text-zinc-800 opacity-20 group-hover:opacity-40 transition duration-500">
                   <ArrowUpRight size={48} />
                </div>
              </div>
            ))}
          </div>

          <div className="max-w-4xl mx-auto">
             {/* Breakdown Section */}
             <div className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-10 space-y-10 shadow-2xl">
                <div className="flex items-center gap-4">
                   <Target size={20} className="text-zinc-600" />
                   <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-100">Manifestation Breakdown</h3>
                </div>

                <div className="space-y-8">
                   <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                         <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-500 border border-zinc-800 group-hover:text-zinc-100 transition duration-500">
                            <ImageIcon size={24} />
                         </div>
                         <div>
                            <div className="text-xs font-black uppercase tracking-widest text-zinc-200">Image Studio</div>
                            <div className="text-[10px] text-zinc-600 font-bold uppercase">Default Manifestation Engine</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-xl font-black italic text-zinc-100 tracking-tighter">{summary.image_count}</div>
                         <div className="text-[10px] font-bold text-zinc-700 uppercase">${(summary.image_count * 0.01).toFixed(2)} Est.</div>
                      </div>
                   </div>

                   <div className="h-px bg-zinc-900/50"></div>

                   <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                         <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-500 border border-zinc-800 group-hover:text-zinc-100 transition duration-500">
                            <Video size={24} />
                         </div>
                         <div>
                            <div className="text-xs font-black uppercase tracking-widest text-zinc-200">Cinematic Flows</div>
                            <div className="text-[10px] text-zinc-600 font-bold uppercase">Orchestration Intelligence</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-xl font-black italic text-zinc-100 tracking-tighter">{summary.video_count}</div>
                         <div className="text-[10px] font-bold text-zinc-700 uppercase">${(summary.video_count * 0.10).toFixed(2)} Est.</div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
