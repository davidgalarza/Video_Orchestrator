import {
  getAllProjects,
  createProject as dbCreateProject,
  deleteProject as dbDeleteProject,
  getProject as dbGetProject,
  getProjectAssets,
  getGlobalAssets as dbGetGlobalAssets,
  createAsset as dbCreateAsset,
  deleteAsset as dbDeleteAsset,
  linkAssetToProject as dbLinkAsset,
  unlinkAssetFromProject as dbUnlinkAsset,
  getScenesByProject,
  createScene as dbCreateScene,
  getScene as dbGetScene,
  updateSceneStatus,
  getUsageSummary as dbGetUsageSummary,
  getCompletedScenesForExport,
  type Project as DBProject,
  type Asset as DBAsset,
  type Scene as DBScene,
} from './db';
import { getSettings as storeGetSettings, saveSettings, type GlobalSettings as StoreSettings } from './store/settings';
import { generateVideo, generateImage, blobToDataUrl } from './ai';
import { stitchVideos, downloadBlob } from './ffmpeg';

// Export types for compatibility
export interface Asset {
  id: string;
  type: string;
  file_path: string;
  is_global: boolean;
  public_url?: string;
  data_url?: string;
}

export interface Scene {
  id: string;
  project_id: string;
  order: number;
  prompt: string;
  status: string;
  video_path?: string;
  public_url?: string;
  first_frame_asset_id?: string;
  last_frame_asset_id?: string;
  first_frame_asset?: Asset;
  last_frame_asset?: Asset;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  assets: Asset[];
  scenes: Scene[];
}

export interface GlobalSettings extends StoreSettings {
  updated_at?: string;
}

// Helper to convert DB asset to API asset
function dbAssetToApiAsset(asset: DBAsset): Asset {
  return {
    id: asset.id,
    type: asset.type,
    file_path: asset.data_url,
    is_global: asset.is_global,
    public_url: asset.data_url,
    data_url: asset.data_url,
  };
}

// Helper to convert DB scene to API scene
function dbSceneToApiScene(scene: DBScene, assets: Asset[]): Scene {
  const firstFrameAsset = scene.first_frame_asset_id 
    ? assets.find(a => a.id === scene.first_frame_asset_id)
    : undefined;
  const lastFrameAsset = scene.last_frame_asset_id
    ? assets.find(a => a.id === scene.last_frame_asset_id)
    : undefined;
  
  return {
    id: scene.id,
    project_id: scene.project_id,
    order: scene.order,
    prompt: scene.prompt,
    status: scene.status,
    video_path: scene.video_url,
    public_url: scene.video_url,
    first_frame_asset_id: scene.first_frame_asset_id,
    last_frame_asset_id: scene.last_frame_asset_id,
    first_frame_asset: firstFrameAsset,
    last_frame_asset: lastFrameAsset,
  };
}

// Helper to build full project with relations
async function buildProject(project: DBProject): Promise<Project> {
  const [assets, scenes] = await Promise.all([
    getProjectAssets(project.id),
    getScenesByProject(project.id),
  ]);
  
  const apiAssets = assets.map(dbAssetToApiAsset);
  
  return {
    id: project.id,
    name: project.name,
    created_at: project.created_at,
    assets: apiAssets,
    scenes: scenes.map(s => dbSceneToApiScene(s, apiAssets)),
  };
}

// Settings
export const getSettings = (): GlobalSettings => {
  const settings = storeGetSettings();
  return {
    ...settings,
    updated_at: new Date().toISOString(),
  };
};

export const updateSettings = (data: Partial<GlobalSettings>): GlobalSettings => {
  const { updated_at, ...rest } = data;
  return saveSettings(rest);
};

// Projects
export const getProjects = async (): Promise<Project[]> => {
  const projects = await getAllProjects();
  return Promise.all(projects.map(buildProject));
};

export const createProject = async (name: string): Promise<Project> => {
  const project = await dbCreateProject(name);
  return buildProject(project);
};

export const deleteProject = async (id: string): Promise<void> => {
  await dbDeleteProject(id);
};

export const getProject = async (id: string): Promise<Project> => {
  const project = await dbGetProject(id);
  if (!project) throw new Error('Project not found');
  return buildProject(project);
};

// Assets
export const getGlobalAssets = async (): Promise<Asset[]> => {
  const assets = await dbGetGlobalAssets();
  return assets.map(dbAssetToApiAsset);
};

export const uploadGlobalAsset = async (type: string, file: File): Promise<Asset> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  
  const asset = await dbCreateAsset(type as DBAsset['type'], dataUrl, file.name, true);
  return dbAssetToApiAsset(asset);
};

export const generateAssets = async (prompt: string, number_of_images: number = 1): Promise<{ assets: Asset[] }> => {
  const blobs = await generateImage(prompt, number_of_images);
  
  const assets: Asset[] = [];
  for (let i = 0; i < blobs.length; i++) {
    const dataUrl = await blobToDataUrl(blobs[i]);
    const asset = await dbCreateAsset('STYLE', dataUrl, `generated_${Date.now()}_${i}.png`, true);
    assets.push(dbAssetToApiAsset(asset));
  }
  
  return { assets };
};

export const linkAssetToProject = async (projectId: string, assetId: string): Promise<void> => {
  await dbLinkAsset(assetId, projectId);
};

export const unlinkAssetFromProject = async (projectId: string, assetId: string): Promise<void> => {
  await dbUnlinkAsset(assetId, projectId);
};

export const deleteAsset = async (id: string): Promise<void> => {
  await dbDeleteAsset(id);
};

// Scenes
export const createScene = async (
  projectId: string, 
  order: number, 
  prompt: string, 
  firstFrameAssetId?: string, 
  lastFrameAssetId?: string
): Promise<Scene> => {
  const scene = await dbCreateScene(projectId, order, prompt, firstFrameAssetId, lastFrameAssetId);
  const assets = await getProjectAssets(projectId);
  return dbSceneToApiScene(scene, assets.map(dbAssetToApiAsset));
};

// Video generation with progress tracking
export const triggerGeneration = async (
  projectId: string, 
  sceneId: string,
  onProgress?: (status: string) => void
): Promise<void> => {
  const scene = await dbGetScene(sceneId);
  if (!scene) throw new Error('Scene not found');
  
  // Update status to processing
  await updateSceneStatus(sceneId, 'processing');
  
  try {
    // Get first frame image if specified
    let firstFrameBlob: Blob | undefined;
    if (scene.first_frame_asset_id) {
      const assets = await getProjectAssets(projectId);
      const asset = assets.find(a => a.id === scene.first_frame_asset_id);
      if (asset) {
        const response = await fetch(asset.data_url);
        firstFrameBlob = await response.blob();
      }
    }
    
    // Generate video
    const result = await generateVideo(scene.prompt, firstFrameBlob, onProgress);
    
    // Save to scene
    await updateSceneStatus(sceneId, 'completed', result.videoBlob);
  } catch (error) {
    console.error('Generation failed:', error);
    await updateSceneStatus(sceneId, 'failed');
    throw error;
  }
};

export const getSceneStatus = async (projectId: string, sceneId: string): Promise<Scene> => {
  const scene = await dbGetScene(sceneId);
  if (!scene) throw new Error('Scene not found');
  const assets = await getProjectAssets(projectId);
  return dbSceneToApiScene(scene, assets.map(dbAssetToApiAsset));
};

// Export project by stitching videos
export const exportProject = async (projectId: string): Promise<{ export_url: string }> => {
  const scenes = await getCompletedScenesForExport(projectId);
  
  if (scenes.length === 0) {
    throw new Error('No completed scenes to export');
  }
  
  if (scenes.length === 1 && scenes[0].video_blob) {
    // Single scene - download directly
    downloadBlob(scenes[0].video_blob, `project_${projectId}.mp4`);
    return { export_url: scenes[0].video_url || '' };
  }
  
  // Stitch multiple scenes
  const videoBlobs = scenes.map(s => s.video_blob).filter(Boolean) as Blob[];
  const stitchedBlob = await stitchVideos(videoBlobs);
  
  downloadBlob(stitchedBlob, `project_${projectId}_stitched.mp4`);
  
  const url = URL.createObjectURL(stitchedBlob);
  return { export_url: url };
};

export const getUsageSummary = dbGetUsageSummary;

// Re-export types
export type { DBProject, DBAsset, DBScene };
