const API_BASE_URL = 'http://localhost:8000';

export interface Asset {
  id: string;
  type: string;
  file_path: string;
  is_global: boolean;
  public_url?: string;
}

export interface Scene {
  id: string;
  project_id: string;
  order: number;
  prompt: string;
  status: string;
  video_path?: string;
  public_url?: string;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  assets: Asset[];
  scenes: Scene[];
}

export interface GlobalSettings {
  model_id: string;
  aspect_ratio: string;
  global_prompt_prefix: string;
  global_prompt_suffix: string;
  updated_at: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.body instanceof FormData) {
    // @ts-ignore
    delete headers['Content-Type'];
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Settings
export const getSettings = () => request<GlobalSettings>('/settings');
export const updateSettings = (data: Partial<GlobalSettings>) => 
  request<GlobalSettings>('/settings', { method: 'PATCH', body: JSON.stringify(data) });

// Projects
export const getProjects = () => request<Project[]>('/projects');
export const createProject = (name: string) => 
  request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name }) });
export const deleteProject = (id: string) => fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' });
export const getProject = (id: string) => request<Project>(`/projects/${id}`);

// Assets
export const getGlobalAssets = () => request<Asset[]>('/assets/global');
export const uploadGlobalAsset = (type: string, file: File) => {
  const formData = new FormData();
  formData.append('type', type);
  formData.append('file', file);
  return request<Asset>('/assets/global', { method: 'POST', body: formData });
};
export const linkAssetToProject = (projectId: string, assetId: string) =>
  request<any>(`/projects/${projectId}/assets/link/${assetId}`, { method: 'POST' });
export const unlinkAssetFromProject = (projectId: string, assetId: string) =>
  request<any>(`/projects/${projectId}/assets/unlink/${assetId}`, { method: 'POST' });

// Scenes
export const createScene = (projectId: string, order: number, prompt: string, firstFrameAssetId?: string) =>
  request<Scene>(`/projects/${projectId}/scenes`, { method: 'POST', body: JSON.stringify({ order, prompt, first_frame_asset_id: firstFrameAssetId }) });
export const triggerGeneration = (projectId: string, sceneId: string) =>
  request<any>(`/projects/${projectId}/scenes/${sceneId}/generate`, { method: 'POST' });
export const getSceneStatus = (projectId: string, sceneId: string) =>
  request<Scene>(`/projects/${projectId}/scenes/${sceneId}/status`);

export const exportProject = (projectId: string) =>
  request<{export_url: string}>(`/projects/${projectId}/export`, { method: 'POST' });
