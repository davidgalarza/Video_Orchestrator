import { openDB, type IDBPDatabase } from 'idb';

export interface Project {
  id: string;
  name: string;
  created_at: string;
}

export interface Asset {
  id: string;
  type: 'CHARACTER' | 'PRODUCT' | 'STYLE';
  data_url: string; // Base64 or blob URL
  file_name: string;
  is_global: boolean;
  project_ids: string[]; // Linked projects
  created_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  order: number;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_blob?: Blob;
  video_url?: string; // Object URL for playback
  first_frame_asset_id?: string;
  last_frame_asset_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UsageLog {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  model_id: string;
  total_tokens: number;
  estimated_cost: number;
  created_at: string;
}

const DB_NAME = 'vid-gen-studio';
const DB_VERSION = 1;

let db: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (db) return db;
  
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('scenes')) {
        const sceneStore = db.createObjectStore('scenes', { keyPath: 'id' });
        sceneStore.createIndex('by-project', 'project_id');
      }
      if (!db.objectStoreNames.contains('usage_logs')) {
        db.createObjectStore('usage_logs', { keyPath: 'id' });
      }
    },
  });
  
  return db;
}

// Projects
export async function getAllProjects(): Promise<Project[]> {
  const db = await initDB();
  return db.getAll('projects');
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await initDB();
  return db.get('projects', id);
}

export async function createProject(name: string): Promise<Project> {
  const db = await initDB();
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    created_at: new Date().toISOString(),
  };
  await db.put('projects', project);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await initDB();
  
  // Delete associated scenes
  const scenes = await getScenesByProject(id);
  for (const scene of scenes) {
    if (scene.video_url) {
      URL.revokeObjectURL(scene.video_url);
    }
    await db.delete('scenes', scene.id);
  }
  
  // Delete project
  await db.delete('projects', id);
}

// Assets
export async function getAllAssets(): Promise<Asset[]> {
  const db = await initDB();
  return db.getAll('assets');
}

export async function getGlobalAssets(): Promise<Asset[]> {
  const assets = await getAllAssets();
  return assets.filter(a => a.is_global);
}

export async function getProjectAssets(projectId: string): Promise<Asset[]> {
  const assets = await getAllAssets();
  return assets.filter(a => a.project_ids.includes(projectId));
}

export async function createAsset(
  type: Asset['type'],
  dataUrl: string,
  fileName: string,
  isGlobal: boolean = false
): Promise<Asset> {
  const db = await initDB();
  const asset: Asset = {
    id: crypto.randomUUID(),
    type,
    data_url: dataUrl,
    file_name: fileName,
    is_global: isGlobal,
    project_ids: [],
    created_at: new Date().toISOString(),
  };
  await db.put('assets', asset);
  return asset;
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('assets', id);
}

export async function linkAssetToProject(assetId: string, projectId: string): Promise<void> {
  const db = await initDB();
  const asset = await db.get('assets', assetId);
  if (asset && !asset.project_ids.includes(projectId)) {
    asset.project_ids.push(projectId);
    await db.put('assets', asset);
  }
}

export async function unlinkAssetFromProject(assetId: string, projectId: string): Promise<void> {
  const db = await initDB();
  const asset = await db.get('assets', assetId);
  if (asset) {
    asset.project_ids = asset.project_ids.filter((id: string) => id !== projectId);
    await db.put('assets', asset);
  }
}

// Scenes
export async function getScenesByProject(projectId: string): Promise<Scene[]> {
  const db = await initDB();
  const scenes = await db.getAllFromIndex('scenes', 'by-project', projectId);
  return scenes.sort((a, b) => a.order - b.order);
}

export async function getScene(id: string): Promise<Scene | undefined> {
  const db = await initDB();
  return db.get('scenes', id);
}

export async function createScene(
  projectId: string,
  order: number,
  prompt: string,
  firstFrameAssetId?: string,
  lastFrameAssetId?: string
): Promise<Scene> {
  const db = await initDB();
  const scene: Scene = {
    id: crypto.randomUUID(),
    project_id: projectId,
    order,
    prompt,
    status: 'pending',
    first_frame_asset_id: firstFrameAssetId,
    last_frame_asset_id: lastFrameAssetId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.put('scenes', scene);
  return scene;
}

export async function updateSceneStatus(
  sceneId: string,
  status: Scene['status'],
  videoBlob?: Blob
): Promise<void> {
  const db = await initDB();
  const scene = await db.get('scenes', sceneId);
  if (scene) {
    scene.status = status;
    scene.updated_at = new Date().toISOString();
    if (videoBlob) {
      // Revoke old URL if exists
      if (scene.video_url) {
        URL.revokeObjectURL(scene.video_url);
      }
      scene.video_blob = videoBlob;
      scene.video_url = URL.createObjectURL(videoBlob);
    }
    await db.put('scenes', scene);
  }
}

export async function deleteScene(id: string): Promise<void> {
  const db = await initDB();
  const scene = await db.get('scenes', id);
  if (scene?.video_url) {
    URL.revokeObjectURL(scene.video_url);
  }
  await db.delete('scenes', id);
}

// Usage Logs
export async function logUsage(
  type: UsageLog['type'],
  modelId: string,
  tokens: number,
  cost: number
): Promise<void> {
  const db = await initDB();
  const log: UsageLog = {
    id: crypto.randomUUID(),
    type,
    model_id: modelId,
    total_tokens: tokens,
    estimated_cost: cost,
    created_at: new Date().toISOString(),
  };
  await db.put('usage_logs', log);
}

export async function getUsageSummary(): Promise<{
  total_tokens: number;
  total_cost: number;
  image_count: number;
  video_count: number;
}> {
  const db = await initDB();
  const logs = await db.getAll('usage_logs');
  
  return {
    total_tokens: logs.reduce((sum, log) => sum + log.total_tokens, 0),
    total_cost: logs.reduce((sum, log) => sum + log.estimated_cost, 0),
    image_count: logs.filter(l => l.type === 'IMAGE').length,
    video_count: logs.filter(l => l.type === 'VIDEO').length,
  };
}

// Export video stitching data
export async function getCompletedScenesForExport(projectId: string): Promise<Scene[]> {
  const scenes = await getScenesByProject(projectId);
  return scenes
    .filter(s => s.status === 'completed' && s.video_blob)
    .sort((a, b) => a.order - b.order);
}

// Get all scenes with videos for video library
export async function getAllScenesWithVideos(): Promise<Scene[]> {
  const db = await initDB();
  const scenes = await db.getAll('scenes');
  return scenes
    .filter(s => s.video_blob && s.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
