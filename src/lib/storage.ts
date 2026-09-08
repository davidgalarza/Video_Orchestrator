import { openDB, type DBSchema } from "idb";
import {
  sceneSettings,
  sequenceScenes,
  activeVersion,
  sceneBlob,
  type Project,
  type Scene,
  type Asset,
  type ClipVersion,
  type VideoSettings,
  type QueuedGeneration,
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
    scenes: scenes
      .filter((s) => !s.deleted_at)
      .sort((a, b) => a.order - b.order),
    trash: scenes
      .filter((s) => s.deleted_at)
      .sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!)),
    assets: assets.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    usage,
  };
}
export async function enqueueGenerations(items: QueuedGeneration[]) {
  const db = await connection;
  const tx = db.transaction("scenes", "readwrite");
  for (const item of items) {
    const scene = await tx.store.get(item.sceneId);
    if (!scene || scene.deleted_at) {
      tx.abort();
      throw new Error("El clip ya no está disponible.");
    }
    await tx.store.put({
      ...scene,
      generation_queue: [...(scene.generation_queue || []), item],
    });
  }
  await tx.done;
}
// Allocate each output and its queue entry together; no empty clips survive a failed enqueue.
export async function enqueueClipOutputs(items: QueuedGeneration[]) {
  const database = await connection;
  const tx = database.transaction(["scenes", "projects"], "readwrite");
  const store = tx.objectStore("scenes");
  const all = await store.getAll();
  const queued: QueuedGeneration[] = [];
  for (const item of items) {
    const source = all.find((s) => s.id === item.sceneId && !s.deleted_at);
    if (!source) {
      tx.abort();
      throw new Error("El clip ya no está disponible.");
    }
    const reuse =
      item.task.mode === "generate" &&
      !sceneBlob(source) &&
      !source.task &&
      !source.generation_queue?.length;
    const mode = item.task.mode;
    const number =
      all.filter(
        (s) => s.origin?.sceneId === source.id && s.origin.mode === mode,
      ).length + 1;
    const label =
      mode === "edit" ? "Edición" : mode === "extend" ? "Extensión" : "Toma";
    const target: Scene = reuse
      ? source
      : {
          ...makeScene(
            source.project_id,
            Math.max(
              -1,
              ...all
                .filter((s) => s.project_id === source.project_id)
                .map((s) => s.order),
            ) + 1,
            item.task.settings,
          ),
          title: `${(source.title || "Clip").slice(0, 40)} · ${label} ${number}`,
          prompt: mode === "generate" ? item.task.prompt : source.prompt,
          edit_prompt: mode === "edit" ? item.task.prompt : undefined,
          extend_prompt: mode === "extend" ? item.task.prompt : undefined,
          first_frame_asset_id:
            mode === "generate" ? source.first_frame_asset_id : undefined,
          last_frame_asset_id:
            mode === "generate" ? source.last_frame_asset_id : undefined,
          reference_asset_ids:
            mode === "generate" ? source.reference_asset_ids : undefined,
          origin: {
            sceneId: source.id,
            versionId: activeVersion(source)?.id,
            title: source.title || "Clip",
            mode,
          },
        };
    const request = { ...item, sceneId: target.id };
    target.output_request = { task: item.task, images: item.images };
    target.generation_queue = [request];
    await store.put(target);
    if (!reuse) all.push(target);
    const project = await tx.objectStore("projects").get(source.project_id);
    if (project)
      await tx.objectStore("projects").put({ ...project, updated_at: now() });
    queued.push(request);
  }
  await tx.done;
  return queued;
}

export async function separateVersions(sceneId: string) {
  const database = await connection;
  const tx = database.transaction("scenes", "readwrite");
  const source = await tx.store.get(sceneId);
  if (
    !source ||
    source.deleted_at ||
    source.task ||
    source.generation_queue?.length
  )
    throw new Error("Espera a que termine la generación de este clip.");
  const selected = activeVersion(source);
  if (!selected || (source.versions?.length || 0) < 2) {
    await tx.done;
    return;
  }
  const all = await tx.store.index("by-project").getAll(source.project_id);
  let order = Math.max(...all.map((s) => s.order));
  for (const [index, version] of source.versions!.entries()) {
    if (version.id === selected.id) continue;
    const clip = makeScene(source.project_id, ++order, version.settings);
    await tx.store.put({
      ...clip,
      title: `${(source.title || "Clip").slice(0, 40)} · Toma ${index + 1}`,
      prompt: version.prompt,
      versions: [version],
      active_version_id: version.id,
      status: "completed",
      origin: {
        sceneId,
        versionId: version.id,
        title: source.title || "Clip",
        mode: version.mode,
      },
    });
  }
  await tx.store.put({
    ...source,
    versions: [selected],
    active_version_id: selected.id,
  });
  await tx.done;
}
export async function startQueuedGeneration(item: QueuedGeneration) {
  const db = await connection;
  const tx = db.transaction("scenes", "readwrite");
  const scene = await tx.store.get(item.sceneId);
  if (
    !scene ||
    scene.deleted_at ||
    !scene.generation_queue?.some((q) => q.id === item.id)
  ) {
    await tx.done;
    return false;
  }
  if (item.resume && scene.task?.remoteId !== item.task.remoteId) {
    await tx.store.put({
      ...scene,
      generation_queue: scene.generation_queue.filter((q) => q.id !== item.id),
    });
    await tx.done;
    return false;
  }
  await tx.store.put({
    ...scene,
    generation_queue: scene.generation_queue.filter((q) => q.id !== item.id),
    task: item.task,
    status: "processing",
    error: undefined,
  });
  await tx.done;
  return true;
}
export async function cancelQueuedGenerations(sceneId: string) {
  await patchScene(sceneId, { generation_queue: [] });
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
    sequence_ids: [],
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
  if (!scene || scene.deleted_at)
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
  const db = await connection;
  const tx = db.transaction(["scenes", "projects"], "readwrite");
  const scene = await tx.objectStore("scenes").get(id);
  if (scene && !scene.deleted_at) {
    const project = await tx.objectStore("projects").get(scene.project_id);
    const all = await tx
      .objectStore("scenes")
      .index("by-project")
      .getAll(scene.project_id);
    const sequence = project
      ? sequenceScenes(
          project,
          all.filter((s) => !s.deleted_at),
        ).map((s) => s.id)
      : [];
    await tx.objectStore("scenes").put({
      ...scene,
      deleted_at: now(),
      generation_queue: [],
      deleted_sequence_index: sequence.indexOf(id),
    });
    if (project)
      await tx.objectStore("projects").put({
        ...project,
        sequence_ids: sequence.filter((item) => item !== id),
        updated_at: now(),
      });
  }
  await tx.done;
}
export async function restoreScene(id: string) {
  const db = await connection;
  const tx = db.transaction(["scenes", "projects"], "readwrite");
  const scene = await tx.objectStore("scenes").get(id);
  if (scene?.deleted_at) {
    const project = await tx.objectStore("projects").get(scene.project_id);
    if (!project) throw new Error("El proyecto ya no existe.");
    const sequence = [...(project.sequence_ids || [])];
    if ((scene.deleted_sequence_index ?? -1) >= 0 && !sequence.includes(id))
      sequence.splice(
        Math.min(scene.deleted_sequence_index!, sequence.length),
        0,
        id,
      );
    await tx.objectStore("scenes").put({
      ...scene,
      deleted_at: undefined,
      deleted_sequence_index: undefined,
      updated_at: now(),
    });
    await tx
      .objectStore("projects")
      .put({ ...project, sequence_ids: sequence, updated_at: now() });
  }
  await tx.done;
}
export async function saveSequence(projectId: string, ids: string[]) {
  const db = await connection;
  const tx = db.transaction(["projects", "scenes"], "readwrite");
  const project = await tx.objectStore("projects").get(projectId);
  const scenes = await tx
    .objectStore("scenes")
    .index("by-project")
    .getAll(projectId);
  if (
    !project ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !scenes.some((s) => s.id === id && !s.deleted_at))
  )
    throw new Error(
      "Los clips del proyecto cambiaron. Vuelve a seleccionarlos.",
    );
  await tx
    .objectStore("projects")
    .put({ ...project, sequence_ids: ids, updated_at: now() });
  await tx.done;
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
      await tx.objectStore("assets").put({
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
    await tx.objectStore("scenes").put({
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
