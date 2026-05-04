import { useEffect, useState } from 'react';
import { getGlobalAssets, uploadGlobalAsset, linkAssetToProject, deleteAsset } from '../api';
import type { Asset } from '../api';
import { 
  Upload, Plus, Image as ImageIcon, Check, 
  Loader2, Filter, Grid, List as ListIcon,
  Search, Package, Trash2, ExternalLink
} from 'lucide-react';
import { useNotification } from '../components/Notification';

export function LibraryView({ activeProjectId }: { activeProjectId: string | null }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'CHARACTER' | 'PRODUCT' | 'STYLE'>('CHARACTER');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CHARACTER' | 'PRODUCT' | 'STYLE'>('ALL');
  const { showNotification, hideNotification } = useNotification();

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const data = await getGlobalAssets();
      setAssets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Permanently destroy this asset? This will remove it from all flows.')) return;
    try {
      await deleteAsset(id);
      setAssets(assets.filter(a => a.id !== id));
      showNotification('Asset purged from library', 'info');
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         a.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || a.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const tid = showNotification(`Uploading ${file.name}...`, 'loading');
    try {
      const a = await uploadGlobalAsset(uploadType, file);
      setAssets([a, ...assets]);
      hideNotification(tid);
      showNotification('Asset added to Library', 'success');
    } catch (err: any) {
      hideNotification(tid);
      showNotification(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      <header className="px-10 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div>
              <div className="flex items-center gap-3 mb-2">
                 <Package size={24} className="text-zinc-600" />
                 <h2 className="text-4xl font-black text-zinc-100 tracking-tighter uppercase italic">Asset Library</h2>
              </div>
              <p className="text-zinc-500 text-sm font-medium">Manage your global characters, products, and styles across all flows.</p>
           </div>

           <div className="flex items-center gap-4">
              <select 
                value={uploadType}
                onChange={(e: any) => setUploadType(e.target.value)}
                className="bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-400 focus:outline-none focus:border-zinc-800 transition cursor-pointer"
              >
                <option value="CHARACTER">Character</option>
                <option value="PRODUCT">Product</option>
                <option value="STYLE">Style Reference</option>
              </select>
              
              <label className="bg-zinc-100 hover:bg-white text-black rounded-xl px-8 py-3 flex items-center gap-3 transition font-black cursor-pointer text-xs uppercase tracking-widest shadow-xl shadow-black/20">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Upload Asset
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
           </div>
        </div>

        <div className="mt-12 flex items-center justify-between border-b border-zinc-900 pb-6">
           <div className="flex items-center gap-6">
              <div className="relative">
                 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                 <input 
                    placeholder="Search library..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-zinc-950 border border-zinc-900 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-zinc-800 transition w-64"
                 />
              </div>
              <div className="w-px h-4 bg-zinc-900"></div>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition cursor-pointer ${viewMode === 'grid' ? 'text-zinc-100 bg-zinc-900' : 'text-zinc-600 hover:text-zinc-400'}`}
                 >
                  <Grid size={14} />
                 </button>
                 <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition cursor-pointer ${viewMode === 'list' ? 'text-zinc-100 bg-zinc-900' : 'text-zinc-600 hover:text-zinc-400'}`}
                 >
                  <ListIcon size={14} />
                 </button>
              </div>
           </div>
           
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700 mr-2 flex items-center gap-2">
                <Filter size={12} />
                Filter
              </span>
              {(['ALL', 'CHARACTER', 'PRODUCT', 'STYLE'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`
                    px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition cursor-pointer
                    ${filterType === type ? 'bg-zinc-100 text-black' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}
                  `}
                >
                  {type}
                </button>
              ))}
           </div>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto px-10 pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-64">
             <Loader2 className="animate-spin text-zinc-800" size={32} />
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {filteredAssets.map(asset => (
              <div key={asset.id} className="group relative bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 hover:border-zinc-700 transition-all duration-500 overflow-hidden shadow-2xl">
                <div className="aspect-square rounded-xl overflow-hidden mb-3 relative">
                  <img src={asset.public_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[8px] font-black uppercase tracking-tighter text-zinc-300 border border-white/10">
                    {asset.type}
                  </div>
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                     <button 
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition cursor-pointer"
                     >
                        <Trash2 size={14} />
                     </button>
                     <a 
                        href={asset.public_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                     >
                        <ExternalLink size={14} />
                     </a>
                  </div>
                </div>
                
                <div className="space-y-1">
                   <div className="text-[10px] text-zinc-300 font-bold uppercase truncate">{asset.id.split('-')[0]}</div>
                   <div className="text-[9px] text-zinc-600 font-medium uppercase tracking-widest">{asset.type}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssets.map(asset => (
              <div key={asset.id} className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-900 rounded-xl hover:border-zinc-800 transition group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-800">
                    <img src={asset.public_url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-zinc-300">{asset.type}</div>
                    <div className="text-[9px] text-zinc-600 font-bold truncate w-32">{asset.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <a 
                    href={asset.public_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 text-zinc-600 hover:text-zinc-100 transition cursor-pointer"
                   >
                      <ExternalLink size={16} />
                   </a>
                   <button 
                    onClick={() => handleDeleteAsset(asset.id)}
                    className="p-2 text-zinc-700 hover:text-red-500 transition cursor-pointer"
                   >
                      <Trash2 size={16} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {filteredAssets.length === 0 && !loading && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-700">
             <ImageIcon size={48} className="mb-4 opacity-20" />
             <p className="text-xs font-black uppercase tracking-widest">No assets found</p>
          </div>
        )}
      </div>
    </div>
  );
}
