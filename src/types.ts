export const OMNI_MODEL = "gemini-omni-1.1-flash";
export const VEO_MODEL = "veo-3.1-generate-preview";
export type Model = typeof OMNI_MODEL | typeof VEO_MODEL;
export type AspectRatio = "9:16" | "16:9";
export type Resolution = "360p" | "720p" | "1080p" | "4k";
export type GenerationMode = "generate" | "edit" | "extend";
export interface VideoSettings {
  model: Model;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  duration: number;
}
export const DEFAULT_VIDEO: VideoSettings = {
  model: OMNI_MODEL,
  aspectRatio: "9:16",
  resolution: "720p",
  duration: 8,
};
export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
  sequence_ids?: string[];
}
export function sequenceScenes(project: Project, scenes: Scene[]): Scene[] {
  const own = scenes.filter((s) => s.project_id === project.id);
  // Projects created before optional sequences retain their original montage.
  return project.sequence_ids === undefined
    ? own.slice().sort((a, b) => a.order - b.order)
    : project.sequence_ids.flatMap((id) => own.find((s) => s.id === id) || []);
}
export interface Asset {
  id: string;
  type: "CHARACTER" | "PRODUCT" | "STYLE";
  data_url: string;
  file_name: string;
  is_global: boolean;
  project_ids: string[];
  created_at: string;
}
export interface ClipVersion {
  id: string;
  blob: Blob;
  prompt: string;
  settings: VideoSettings;
  mode: GenerationMode;
  interactionId?: string;
  duration: number;
  created_at: string;
}
export interface GenerationTask {
  remoteId?: string;
  prompt: string;
  settings: VideoSettings;
  mode: GenerationMode;
  previousInteractionId?: string;
  previousDuration?: number;
  started_at: string;
}
export interface QueuedGeneration {
  id: string;
  sceneId: string;
  task: GenerationTask;
  images: {
    mimeType: string;
    data: string;
    role: "first" | "last" | "reference";
  }[];
  index: number;
  total: number;
  created_at: string;
  resume?: boolean;
}
export interface Scene {
  id: string;
  project_id: string;
  order: number;
  title?: string;
  prompt: string;
  edit_prompt?: string;
  extend_prompt?: string;
  deleted_at?: string;
  deleted_sequence_index?: number;
  status: "pending" | "processing" | "completed" | "failed" | "paused";
  settings?: VideoSettings;
  first_frame_asset_id?: string;
  last_frame_asset_id?: string;
  reference_asset_ids?: string[];
  versions?: ClipVersion[];
  active_version_id?: string;
  task?: GenerationTask;
  generation_queue?: QueuedGeneration[];
  error?: string;
  video_blob?: Blob;
  created_at: string;
  updated_at: string;
}
export function activeVersion(scene: Scene): ClipVersion | undefined {
  return (
    scene.versions?.find((v) => v.id === scene.active_version_id) ??
    scene.versions?.at(-1)
  );
}
export function sceneBlob(scene: Scene): Blob | undefined {
  return activeVersion(scene)?.blob ?? scene.video_blob;
}
export function sceneSettings(scene: Scene): VideoSettings {
  return { ...DEFAULT_VIDEO, ...scene.settings };
}
