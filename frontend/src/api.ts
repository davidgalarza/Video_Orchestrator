import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface Asset {
  id: string;
  project_id: string;
  type: string;
  gcs_uri: string;
  public_url?: string;
}

export interface Scene {
  id: string;
  project_id: string;
  order: number;
  prompt: string;
  status: string;
  video_uri?: string;
  public_url?: string;
}

export interface Project {
  id: string;
  name: string;
  system_prompt?: string;
  created_at: string;
  assets: Asset[];
  scenes: Scene[];
}

export const getProjects = async (): Promise<Project[]> => {
  const response = await api.get('/projects');
  return response.data;
};

export const createProject = async (name: string, system_prompt?: string): Promise<Project> => {
  const response = await api.post('/projects', { name, system_prompt });
  return response.data;
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await api.get(`/projects/${id}`);
  return response.data;
};

export const uploadAsset = async (projectId: string, type: string, file: File): Promise<Asset> => {
  const formData = new FormData();
  formData.append('type', type);
  formData.append('file', file);
  const response = await api.post(`/projects/${projectId}/assets`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const createScene = async (projectId: string, order: number, prompt: string): Promise<Scene> => {
  const response = await api.post(`/projects/${projectId}/scenes`, { order, prompt });
  return response.data;
};

export const triggerGeneration = async (projectId: string, sceneId: string): Promise<Scene> => {
  const response = await api.post(`/projects/${projectId}/scenes/${sceneId}/generate`);
  return response.data;
};

export const getSceneStatus = async (projectId: string, sceneId: string): Promise<Scene> => {
  const response = await api.get(`/projects/${projectId}/scenes/${sceneId}/status`);
  return response.data;
};

export default api;
