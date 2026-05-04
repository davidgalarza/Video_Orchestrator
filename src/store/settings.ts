import { openDB } from 'idb';

export interface GlobalSettings {
  model_id: string;
  aspect_ratio: '16:9' | '9:16';
  global_prompt_prefix: string;
  global_prompt_suffix: string;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  model_id: 'veo-3.1-generate-preview',
  aspect_ratio: '16:9',
  global_prompt_prefix: '',
  global_prompt_suffix: 'cinematic, high detail, 8k',
};

const API_KEY_KEY = 'vid_gen_api_key';
const SETTINGS_KEY = 'vid_gen_settings';

// API Key
export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_KEY, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_KEY);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

// Settings
export function getSettings(): GlobalSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Partial<GlobalSettings>): GlobalSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

export function resetSettings(): GlobalSettings {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  return DEFAULT_SETTINGS;
}

// Initialize IndexedDB for blob storage
export async function initStorageDB() {
  return openDB('vid-gen-blobs', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' });
      }
    },
  });
}
