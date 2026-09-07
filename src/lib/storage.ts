import { openDB, type DBSchema } from "idb";
import {
  sceneSettings,
  type Project,
  type Scene,
  type Asset,
  type ClipVersion,
  type VideoSettings,
} from "../types";
interface StudioDB extends DBSchema {
  projects: { key: string; value: Project };
  scenes: { key: string; value: Scene; indexes: { "by-project": string } };
  assets: { key: string; value: Asset };
  usage_logs: {
    key: string;
    value: {
      id: string;
      type: string;
      model_id: string;
      created_at: string;
      total_tokens?: number;
    };
  };
}
const connection = openDB<StudioDB>("vid-gen-studio", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("projects"))
      db.createObjectStore("projects", { keyPath: "id" });
    if (!db.objectStoreNames.contains("assets"))
      db.createObjectStore("assets", { keyPath: "id" });
    if (!db.objectStoreNames.contains("scenes"))
      db.createObjectStore("scenes", { keyPath: "id" }).createIndex(
        "by-project",
        "project_id",
      );
    if (!db.objectStoreNames.contains("usage_logs"))
      db.createObjectStore("usage_logs", { keyPath: "id" });
  },
});
const now = () => new Date().toISOString();
export async function readWorkspace() {
  const db = await connection;
  const [projects, scenes, assets, usage] = await Promise.all([
    db.getAll("projects"),
    db.getAll("scenes"),
    db.getAll("assets"),
    db.getAll("usage_logs"),
  ]);
  return {
    projects: projects.sort((a, b) =>
      (b.updated_at || b.created_at).localeCompare(
        a.updated_at || a.created_at,
      ),
    ),
    scenes: scenes.sort((a, b) => a.order - b.order),
    assets: assets.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    usage,
  };
}
export async function createProject(
  name: string,
  drafts: { title: string; prompt: string }[],
  settings: VideoSettings,
) {
  const db = await connection;
  const project: Project = {
    id: crypto.randomUUID(),
    name: name.trim() || "Proyecto sin título",
    created_at: now(),
    updated_at: now(),
  };
  const tx = db.transaction(["projects", "scenes"], "readwrite");
  await tx.objectStore("projects").put(project);
  for (const [i, draft] of drafts.entries())
    await tx
      .objectStore("scenes")
      .put(makeScene(project.id, i, settings, draft));
  await tx.done;
  return project;
}
function makeScene(
  projectId: string,
  order: number,
  settings: VideoSettings,
  draft?: { title: string; prompt: string },
): Scene {
  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    order,
    title: draft?.title || `Escena ${order + 1}`,
    prompt: draft?.prompt || "",
    status: "pending",
    settings,
    created_at: now(),
    updated_at: now(),
  };
}
export async function addScene(projectId: string, settings: VideoSettings) {
  const db = await connection;
  const tx = db.transaction("scenes", "readwrite");
  const scenes = await tx.store.index("by-project").getAll(projectId);
  const scene = makeScene(
    projectId,
    Math.max(-1, ...scenes.map((s) => s.order)) + 1,
    settings,
  );
  await tx.store.put(scene);
  await tx.done;
  return scene;
}
export async function patchScene(id: string, patch: Partial<Scene>) {
  const db = await connection;
  const tx = db.transaction(["scenes", "projects"], "readwrite");
  const scene = await tx.objectStore("scenes").get(id);
  if (!scene)
    throw new Error("No se encuentra esta escena. Vuelve a abrir el proyecto.");
  const updated = { ...scene, ...patch, id: scene.id, updated_at: now() };
  await tx.objectStore("scenes").put(updated);
  const project = await tx.objectStore("projects").get(scene.project_id);
  if (project)
    await tx.objectStore("projects").put({ ...project, updated_at: now() });
  await tx.done;
  return updated;
}
export async function getScene(id: string) {
  return (await connection).get("scenes", id);
}
export async function saveVersion(sceneId: string, version: ClipVersion) {
  const scene = await getScene(sceneId);
  if (!scene) throw new Error("Escena eliminada.");
  return patchScene(sceneId, {
    versions: [...(scene.versions || []), version],
    active_version_id: version.id,
    status: "completed",
    task: undefined,
    error: undefined,
  });
}
export async function duplicateScene(id: string) {
  const source = await getScene(id);
  if (!source) throw new Error("Escena no encontrada.");
  const copy = await addScene(source.project_id, sceneSettings(source));
  return patchScene(copy.id, {
    title: `${source.title || "Escena"} · copia`,
    prompt: source.prompt,
    first_frame_asset_id: source.first_frame_asset_id,
    last_frame_asset_id: source.last_frame_asset_id,
    reference_asset_ids: source.reference_asset_ids,
  });
}
export async function reorderScenes(projectId: string, ids: string[]) {
  const db = await connection;
  const tx = db.transaction("scenes", "readwrite");
  const scenes = await tx.store.index("by-project").getAll(projectId);
  if (
    ids.length !== scenes.length ||
    new Set(ids).size !== ids.length ||
    scenes.some((s) => !ids.includes(s.id))
  )
    throw new Error("La lista cambió. Vuelve a intentarlo.");
  for (const scene of scenes)
    await tx.store.put({ ...scene, order: ids.indexOf(scene.id) });
  await tx.done;
}
export async function deleteScene(id: string) {
  await (await connection).delete("scenes", id);
}
export async function renameProject(id: string, name: string) {
  const db = await connection;
  const project = await db.get("projects", id);
  if (project && name.trim())
    await db.put("projects", {
      ...project,
      name: name.trim(),
      updated_at: now(),
    });
}
export async function deleteProject(id: string) {
  const db = await connection;
  const tx = db.transaction(["projects", "scenes", "assets"], "readwrite");
  for (const scene of await tx
    .objectStore("scenes")
    .index("by-project")
    .getAll(id))
    await tx.objectStore("scenes").delete(scene.id);
  for (const asset of await tx.objectStore("assets").getAll())
    if (asset.project_ids.includes(id))
      await tx
        .objectStore("assets")
        .put({
          ...asset,
          project_ids: asset.project_ids.filter((p) => p !== id),
        });
  await tx.objectStore("projects").delete(id);
  await tx.done;
}
export async function putAsset(asset: Asset) {
  await (await connection).put("assets", asset);
}
export async function deleteAsset(id: string) {
  const db = await connection;
  const tx = db.transaction(["assets", "scenes"], "readwrite");
  await tx.objectStore("assets").delete(id);
  for (const scene of await tx.objectStore("scenes").getAll())
    await tx
      .objectStore("scenes")
      .put({
        ...scene,
        first_frame_asset_id:
          scene.first_frame_asset_id === id
            ? undefined
            : scene.first_frame_asset_id,
        last_frame_asset_id:
          scene.last_frame_asset_id === id
            ? undefined
            : scene.last_frame_asset_id,
        reference_asset_ids: scene.reference_asset_ids?.filter(
          (ref) => ref !== id,
        ),
      });
  await tx.done;
}
