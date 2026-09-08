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
  type QueuedGeneration,
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
    trash: [],
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
  const queueRef = useRef<QueuedGeneration[]>([]);
  const activeRequest = useRef<QueuedGeneration | null>(null);
  const [queue, setQueue] = useState<QueuedGeneration[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const paused = useRef(false);
  const admission = useRef<Promise<unknown>>(Promise.resolve());
  const publishQueue = () => setQueue([...queueRef.current]);
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
        if (mounted) {
          setData(value);
          const pending = value.scenes
            .flatMap((s) => s.generation_queue || [])
            .sort(
              (a, b) =>
                Number(!!b.resume) - Number(!!a.resume) ||
                a.created_at.localeCompare(b.created_at),
            );
          queueRef.current = pending;
          setQueue(pending);
          paused.current = pending.length > 0;
          setQueuePaused(pending.length > 0);
        }
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
  function run(
    ids: string[],
    mode: GenerationMode = "generate",
    instruction?: string,
    resume = false,
    count = 1,
  ): Promise<boolean> {
    const enqueue = async () => {
      try {
        if (!getApiKey())
          throw new Error(
            "Conecta tu clave de Google en Ajustes antes de generar.",
          );
        if (!Number.isInteger(count) || count < 1 || count > 20)
          throw new Error("Elige entre 1 y 20 versiones por solicitud.");
        const current = await db.readWorkspace();
        const items: QueuedGeneration[] = [];
        for (const id of new Set(ids)) {
          const scene = current.scenes.find((s) => s.id === id);
          if (!scene) throw new Error("El clip ya no está disponible.");
          if (
            resume &&
            ((controller.current && activeRequest.current?.sceneId === id) ||
              queueRef.current.some((q) => q.sceneId === id && q.resume))
          )
            throw new Error("Este resultado ya se está recuperando.");
          if (resume && !scene.task?.remoteId)
            throw new Error("No hay un identificador que recuperar.");
          if (
            !resume &&
            scene.task?.remoteId &&
            activeRequest.current?.sceneId !== id
          )
            throw new Error(
              "Recupera el resultado pendiente de este clip antes de generar de nuevo.",
            );
          const selected = activeVersion(scene);
          const task: GenerationTask = resume
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
          const images: ReferenceImage[] = [];
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
              const match = current.assets
                .find((a) => a.id === assetId)
                ?.data_url.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
              if (!match)
                throw new Error(
                  "Falta una referencia válida. Selecciónala de nuevo antes de generar.",
                );
              images.push({ mimeType: match[1], data: match[2], role });
            }
          }
          if (!resume)
            (task.settings.model === OMNI_MODEL
              ? buildOmniPayload
              : buildVeoPayload)(task, images);
          const total = resume ? 1 : count;
          for (let index = 1; index <= total; index++)
            items.push({
              id: crypto.randomUUID(),
              sceneId: id,
              task: { ...task },
              images,
              index,
              total,
              created_at: new Date().toISOString(),
              resume,
            });
        }
        if (!items.length) return false;
        await db.enqueueGenerations(items);
        queueRef.current = resume
          ? [...items, ...queueRef.current]
          : [...queueRef.current, ...items];
        publishQueue();
        await refresh();
        setNotice(null);
        if (resume) {
          paused.current = false;
          setQueuePaused(false);
        }
        if (!paused.current) void drain();
        return true;
      } catch (e) {
        notify(errorMessage(e), true);
        return false;
      }
    };
    const accepted = admission.current.then(enqueue);
    admission.current = accepted;
    return accepted;
  }
  async function drain() {
    if (controller.current || paused.current || !queueRef.current.length)
      return;
    const apiKey = getApiKey();
    if (!apiKey) {
      notify("Conecta Google para continuar la cola.", true);
      return;
    }
    const ctrl = new AbortController();
    controller.current = ctrl;
    async function processQueue() {
      while (queueRef.current.length && !paused.current) {
        if (ctrl.signal.aborted) break;
        const item = queueRef.current[0];
        const id = item.sceneId;
        const scene = await db.getScene(id);
        if (!scene || scene.deleted_at) {
          queueRef.current = queueRef.current.filter((q) => q.id !== item.id);
          publishQueue();
          continue;
        }
        let task: GenerationTask = item.task;
        try {
          if (!item.resume && scene.task?.remoteId)
            throw new Error(
              "Recupera el resultado pendiente antes de continuar las versiones de este clip.",
            );
          if (ctrl.signal.aborted) break;
          if (!(await db.startQueuedGeneration(item))) {
            queueRef.current = queueRef.current.filter((q) => q.id !== item.id);
            publishQueue();
            continue;
          }
          queueRef.current = queueRef.current.filter((q) => q.id !== item.id);
          publishQueue();
          activeRequest.current = item;
          setJob({
            sceneId: id,
            text: item.resume
              ? "Recuperando resultado…"
              : "Preparando generación…",
            index: item.index,
            total: item.total,
          });
          await refresh();
          const result = await generateVideo({
            apiKey,
            task,
            images: item.images,
            signal: ctrl.signal,
            onProgress: (text) =>
              setJob({
                sceneId: id,
                text,
                index: item.index,
                total: item.total,
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
        } catch (e) {
          const message = errorMessage(e);
          await patch(id, {
            status: ctrl.signal.aborted || task?.remoteId ? "paused" : "failed",
            error: message,
          }).catch(() => undefined);
          notify(message, true);
          paused.current = true;
          setQueuePaused(true);
          break; // Preserve waiting requests without issuing more paid calls after a failure.
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
      paused.current = true;
      setQueuePaused(true);
    } finally {
      controller.current = null;
      activeRequest.current = null;
      setJob(null);
    }
  }
  return {
    ...data,
    loading,
    notice,
    setNotice,
    job,
    queue,
    queuePaused,
    recovery,
    setRecovery,
    refresh,
    notify,
    action,
    patch,
    run,
    pause: () => {
      paused.current = true;
      setQueuePaused(true);
      controller.current?.abort();
    },
    continueQueue: () => {
      paused.current = false;
      setQueuePaused(false);
      void drain();
    },
    cancelQueued: (sceneId: string) =>
      action(async () => {
        await db.cancelQueuedGenerations(sceneId);
        queueRef.current = queueRef.current.filter(
          (q) => q.sceneId !== sceneId,
        );
        publishQueue();
      }),
  };
}
export type WorkspaceController = ReturnType<typeof useWorkspace>;
