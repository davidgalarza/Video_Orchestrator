import { useEffect, useState } from 'react';
import { getGlobalAssets, linkAssetToProject, unlinkAssetFromProject } from '../api';
import type { Asset, Project } from '../api';
import { Plus, X, Package, Loader2, Image as ImageIcon } from 'lucide-react';
import { useNotification } from './Notification';

interface AssetTrayProps {
  project: Project;
  onRefresh: () => void;
  refreshKey?: number;
}

export function AssetTray({ project, onRefresh, refreshKey }: AssetTrayProps) {
  const [globalAssets, setGlobalAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const { showNotification, hideNotification } = useNotification();

  useEffect(() => {
    fetchGlobalAssets();
  }, [refreshKey]);

  const fetchGlobalAssets = async () => {
    try {
      const data = await getGlobalAssets();
      setGlobalAssets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isLinked = (assetId: string) => project.assets.some(a => a.id === assetId);

  const handleToggleLink = async (assetId: string) => {
    const tid = showNotification(isLinked(assetId) ? 'Unlinking...' : 'Linking...', 'loading');
    try {
      if (isLinked(assetId)) {
        await unlinkAssetFromProject(project.id, assetId);
      } else {
        await linkAssetToProject(project.id, assetId);
      }
      hideNotification(tid);
      onRefresh();
    } catch (err: any) {
      hideNotification(tid);
      showNotification(err.message, 'error');
    }
  };

  if (loading) return null;

  return (
    <div className="w-full bg-[#09090b]/50 backdrop-blur-md border-b border-zinc-900 px-10 py-4">
      <div className="flex items-center gap-4 mb-3">
         <div className="flex items-center gap-2 text-zinc-500">
            <Package size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Global Asset Library</span>
         </div>
         <div className="flex-grow h-px bg-zinc-900/50"></div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {globalAssets.map(asset => (
          <div 
            key={asset.id} 
            className={`
              relative flex-shrink-0 group w-24 h-24 rounded-xl overflow-hidden border-2 transition-all cursor-pointer
              ${isLinked(asset.id) ? 'border-zinc-100 scale-95 shadow-xl shadow-black/40' : 'border-zinc-900 opacity-40 hover:opacity-100 hover:border-zinc-700'}
            `}
            onClick={() => handleToggleLink(asset.id)}
          >
            <img src={asset.public_url} alt="" className="w-full h-full object-cover" />
            
            <div className={`
              absolute inset-0 flex items-center justify-center transition-opacity
              ${isLinked(asset.id) ? 'bg-zinc-100/10' : 'bg-black/60 opacity-0 group-hover:opacity-100'}
            `}>
              {isLinked(asset.id) ? (
                <div className="bg-zinc-100 text-black p-1.5 rounded-lg shadow-lg">
                   <X size={12} />
                </div>
              ) : (
                <div className="bg-zinc-900 text-zinc-100 p-1.5 rounded-lg border border-zinc-700">
                   <Plus size={12} />
                </div>
              )}
            </div>

            <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/60 rounded text-[6px] font-black uppercase text-zinc-400">
               {asset.type}
            </div>
          </div>
        ))}

        {globalAssets.length === 0 && (
          <div className="flex items-center justify-center py-6 px-10 border-2 border-dashed border-zinc-900 rounded-2xl">
             <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Library is empty. Generate some images first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
