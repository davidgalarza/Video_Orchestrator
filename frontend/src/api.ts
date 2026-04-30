const API_BASE_URL = 'http://localhost:8000';

export interface Asset {
  id: string;
  project_id: string;
  type: string;
  file_path: string;
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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const getProjects = async (): Promise<Project[]> => {
  return request<Project[]>('/projects');
};

export const createProject = async (name: string): Promise<Project> => {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  await fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' });
};

export const getProject = async (id: string): Promise<Project> => {
  return request<Project>(`/projects/${id}`);
};

export const uploadAsset = async (projectId: string, type: string, file: File): Promise<Asset> => {
  const formData = new FormData();
  formData.append('type', type);
  formData.append('file', file);
  
  return request<Asset>(`/projects/${projectId}/assets`, {
    method: 'POST',
    body: formData,
  });
};

export const createScene = async (projectId: string, order: number, prompt: string): Promise<Scene> => {
  return request<Scene>(`/projects/${projectId}/scenes`, {
    method: 'POST',
    body: JSON.stringify({ order, prompt }),
  });
};

export const triggerGeneration = async (projectId: string, sceneId: string): Promise<{message: string}> => {
  return request<{message: string}>(`/projects/${projectId}/scenes/${sceneId}/generate`, {
    method: 'POST',
  });
};

export const getSceneStatus = async (projectId: string, sceneId: string): Promise<Scene> => {
  return request<Scene>(`/projects/${projectId}/scenes/${sceneId}/status`);
};

export const exportProject = async (projectId: string): Promise<{export_url: string}> => {
  return request<{export_url: string}>(`/projects/${projectId}/export`, {
    method: 'POST',
  });
};
