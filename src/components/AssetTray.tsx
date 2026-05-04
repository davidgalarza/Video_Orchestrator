import { useEffect, useState } from 'react';
import { getGlobalAssets, linkAssetToProject, unlinkAssetFromProject } from '../api';
import type { Asset, Project } from '../api';
import { Plus, X, Package, Image as ImageIcon } from 'lucide-react';
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
    <div className="flex flex-col h-full">
      <div className="px-1.5 py-4">
        <div className="flex items-center gap-1.5 mb-3 px-1">
           <Package size={10} className="text-zinc-600" />
           <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-100">Library</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-1 max-h-full overflow-y-auto pb-10 custom-scrollbar">
          {globalAssets.map(asset => (
            <div 
              key={asset.id} 
              className={`
                relative group aspect-square rounded-md overflow-hidden border transition-all cursor-pointer
                ${isLinked(asset.id) ? 'border-zinc-100 scale-95' : 'border-zinc-900 opacity-40 hover:opacity-100 hover:border-zinc-700'}
              `}
              onClick={() => handleToggleLink(asset.id)}
            >
              <img src={asset.public_url} alt="" className="w-full h-full object-cover" />
              
              <div className={`
                absolute inset-0 flex items-center justify-center transition-opacity
                ${isLinked(asset.id) ? 'bg-zinc-100/10' : 'bg-black/60 opacity-0 group-hover:opacity-100'}
              `}>
                {isLinked(asset.id) ? (
                  <div className="bg-zinc-100 text-black p-1 rounded-md shadow-lg">
                     <X size={10} />
                  </div>
                ) : (
                  <div className="bg-zinc-900 text-zinc-100 p-1 rounded-md border border-zinc-700">
                     <Plus size={10} />
                  </div>
                )}
              </div>

              <div className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-black/60 rounded-[2px] text-[5px] font-black uppercase text-zinc-400">
                 {asset.type}
              </div>
            </div>
          ))}

          {globalAssets.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-8 px-4 border border-dashed border-zinc-900 rounded-2xl text-center">
               <ImageIcon size={16} className="text-zinc-800 mb-2" />
               <p className="text-[8px] font-black uppercase tracking-widest text-zinc-700 leading-tight">
                 Empty Library
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
