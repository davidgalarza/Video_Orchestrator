import { useState } from 'react';
import { uploadAsset } from '../api';
import type { Asset } from '../api';
import { Image as ImageIcon, Upload, X, Loader2 } from 'lucide-react';
import { useNotification } from './Notification';

interface AssetTrayProps {
  projectId: string;
  assets: Asset[];
  onAssetUploaded: (asset: Asset) => void;
}

export function AssetTray({ projectId, assets, onAssetUploaded }: AssetTrayProps) {
  const { showNotification, hideNotification } = useNotification();
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'CHARACTER' | 'PRODUCT' | 'STYLE'>('CHARACTER');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const toastId = showNotification(`Syncing ${file.name}...`, 'loading');
    try {
      const newAsset = await uploadAsset(projectId, uploadType, file);
      onAssetUploaded(newAsset);
      hideNotification(toastId);
      showNotification('Asset cataloged', 'success');
    } catch (error: any) {
      console.error('Upload failed', error);
      hideNotification(toastId);
      showNotification(error.message || 'Transmission failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-80 flex-shrink-0 bg-zinc-950 border-r border-zinc-900 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
          <ImageIcon size={18} className="text-zinc-500" />
          Asset Tray
        </h3>
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-grow">
        <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Add Ingredient</p>
          <div className="grid grid-cols-3 gap-2">
            {(['CHARACTER', 'PRODUCT', 'STYLE'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setUploadType(type)}
                className={`text-[10px] py-1.5 rounded border transition cursor-pointer ${
                  uploadType === type 
                    ? 'bg-zinc-100 text-black border-zinc-100' 
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-900 transition hover:border-zinc-700">
            {uploading ? (
              <Loader2 className="animate-spin text-zinc-500" size={24} />
            ) : (
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="text-zinc-500 mb-2" size={20} />
                <p className="text-[10px] text-zinc-500">Upload {uploadType}</p>
              </div>
            )}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>

        <div className="space-y-4 mt-2">
          {assets.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-10">No assets uploaded yet</p>
          ) : (
            assets.map((asset) => (
              <div key={asset.id} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 transition">
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[8px] font-bold text-white uppercase tracking-widest z-10">
                  {asset.type}
                </div>
                <img 
                  src={asset.public_url} 
                  alt={asset.type} 
                  className="w-full h-32 object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
