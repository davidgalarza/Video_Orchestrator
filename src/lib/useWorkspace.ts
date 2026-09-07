import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "./storage";
import { getApiKey } from "./settings";
import {
  buildOmniPayload,
  buildVeoPayload,
  errorMessage,
  generateVideo,
  type ReferenceImage,
} from "./google";
import {
  activeVersion,
  OMNI_MODEL,
  sceneSettings,
  type GenerationMode,
  type GenerationTask,
  type Scene,
  type ClipVersion,
} from "../types";

type Workspace = Awaited<ReturnType<typeof db.readWorkspace>>;
function stableMedia(scene: Scene, previous?: Scene): Scene {
  if (!previous) return scene;
  return {
    ...scene,
    video_blob: previous.video_blob || scene.video_blob,
    versions: scene.versions?.map((version) => ({
      ...version,
      blob:
        previous.versions?.find((v) => v.id === version.id)?.blob ||
        version.blob,
    })),
  };
}
export function useWorkspace() {
  const [data, setData] = useState<Workspace>({
    projects: [],
    scenes: [],
    assets: [],
    usage: [],
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [job, setJob] = useState<{
    sceneId: string;
    text: string;
    index: number;
    total: number;
  } | null>(null);
  const [recovery, setRecovery] = useState<ClipVersion | null>(null);
  const controller = useRef<AbortController | null>(null);
  const notify = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  const refresh = useCallback(async () => {
    const value = await db.readWorkspace();
    setData((current) => ({
      ...value,
      scenes: value.scenes.map((scene) =>
        stableMedia(
          scene,
          current.scenes.find((s) => s.id === scene.id),
        ),
      ),
    }));
    return value;
  }, []);
  useEffect(() => {
    let mounted = true;
    void db
      .readWorkspace()
      .then((value) => {
        if (mounted) setData(value);
      })
      .catch((e) =>
        notify(
          `No se pudo abrir el almacenamiento local. ${errorMessage(e)}`,
          true,
        ),
      )
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [notify]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!job) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [job]);
  const action = useCallback(
    async (fn: () => Promise<unknown>, message?: string) => {
      try {
        await fn();
        await refresh();
        if (message) notify(message);
      } catch (e) {
        notify(errorMessage(e), true);
      }
    },
    [refresh, notify],
  );
  const patch = useCallback(async (id: string, changes: Partial<Scene>) => {
    const scene = await db.patchScene(id, changes);
    setData((current) => ({
      ...current,
      scenes: current.scenes.map((s) =>
        s.id === id ? stableMedia(scene, s) : s,
      ),
    }));
    return scene;
  }, []);
  async function run(
    ids: string[],
    mode: GenerationMode = "generate",
    instruction?: string,
    resume = false,
  ) {
    if (controller.current) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      notify("Conecta tu clave de Google en Ajustes antes de generar.", true);
      return;
    }
    const ctrl = new AbortController();
    controller.current = ctrl;
    async function processQueue() {
      for (const [index, id] of ids.entries()) {
        if (ctrl.signal.aborted) break;
        let scene = await db.getScene(id);
        if (!scene) continue;
        let task: GenerationTask | undefined;
        try {
          const selected = activeVersion(scene);
          if (resume && !scene.task?.remoteId)
            throw new Error(
              "No hay un identificador que recuperar. Revisa tu actividad en Google antes de generar de nuevo.",
            );
          task = resume
            ? scene.task!
            : {
                prompt: mode === "generate" ? scene.prompt : instruction || "",
                settings:
                  mode === "generate"
                    ? sceneSettings(scene)
                    : selected?.settings || sceneSettings(scene),
                mode,
                previousInteractionId:
                  mode === "generate" ? undefined : selected?.interactionId,
                previousDuration: selected?.duration,
                started_at: new Date().toISOString(),
              };
          const current = await db.readWorkspace();
          const refs: ReferenceImage[] = [];
          if (mode === "generate" && !resume) {
            const roles = [
              [scene.first_frame_asset_id, "first"],
              [scene.last_frame_asset_id, "last"],
              ...(scene.reference_asset_ids || []).map((id) => [
                id,
                "reference",
              ]),
            ] as [string | undefined, ReferenceImage["role"]][];
            for (const [assetId, role] of roles) {
              if (!assetId) continue;
              const asset = current.assets.find((a) => a.id === assetId);
              if (!asset)
                throw new Error(
                  "Falta una referencia. Selecciónala de nuevo antes de generar.",
                );
              const match = asset.data_url.match(
                /^data:(image\/[\w.+-]+);base64,(.+)$/s,
              );
              if (!match)
                throw new Error(
                  "La referencia no es una imagen válida. Vuelve a subirla.",
                );
              refs.push({ mimeType: match[1], data: match[2], role });
            }
          }
          // Validate before writing a task or making a paid request.
          if (!resume)
            (task.settings.model === OMNI_MODEL
              ? buildOmniPayload
              : buildVeoPayload)(task, refs);
          scene = await patch(id, {
            status: "processing",
            task,
            error: undefined,
          });
          setJob({
            sceneId: id,
            text: "Preparando generación…",
            index: index + 1,
            total: ids.length,
          });
          const result = await generateVideo({
            apiKey,
            task,
            images: refs,
            signal: ctrl.signal,
            onProgress: (text) =>
              setJob({
                sceneId: id,
                text,
                index: index + 1,
                total: ids.length,
              }),
            onRemoteId: async (remoteId) => {
              task = { ...task!, remoteId };
              await patch(id, { task });
            },
          });
          const version: ClipVersion = {
            id: crypto.randomUUID(),
            blob: result.blob,
            prompt: task.prompt,
            settings: task.settings,
            mode: task.mode,
            interactionId: result.interactionId,
            duration:
              task.mode === "extend"
                ? (task.previousDuration || 0) + 10
                : task.mode === "edit"
                  ? task.previousDuration || task.settings.duration
                  : task.settings.duration,
            created_at: new Date().toISOString(),
          };
          try {
            await db.saveVersion(id, version);
          } catch {
            setRecovery(version);
            throw new Error(
              "El vídeo se generó, pero no cabe en el almacenamiento local. Descárgalo desde el aviso antes de cerrar la pestaña.",
            );
          }
          await refresh();
          notify(`${scene.title || "Escena"}: nueva versión lista.`);
        } catch (e) {
          const message = errorMessage(e);
          await patch(id, {
            status: ctrl.signal.aborted || task?.remoteId ? "paused" : "failed",
            error: message,
          }).catch(() => undefined);
          notify(message, true);
          break; // A quota/access/storage failure must not trigger paid requests for the remaining scenes.
        }
      }
    }
    try {
      if (navigator.locks)
        await navigator.locks.request(
          "vidgen-generation",
          { ifAvailable: true },
          async (lock) => {
            if (!lock)
              throw new Error("Ya hay una generación activa en otra pestaña.");
            await processQueue();
          },
        );
      else await processQueue();
    } catch (e) {
      notify(errorMessage(e), true);
    } finally {
      controller.current = null;
      setJob(null);
    }
  }
  return {
    ...data,
    loading,
    notice,
    setNotice,
    job,
    recovery,
    setRecovery,
    refresh,
    notify,
    action,
    patch,
    run,
    pause: () => controller.current?.abort(),
  };
}
export type WorkspaceController = ReturnType<typeof useWorkspace>;
