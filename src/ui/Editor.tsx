import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Film,
  Frame,
  History,
  ImagePlus,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import type { WorkspaceController } from "../lib/useWorkspace";
import * as db from "../lib/storage";
import { storeImage, downloadBlob } from "../lib/media";
import {
  activeVersion,
  sceneBlob,
  sceneSettings,
  OMNI_MODEL,
  type Asset,
  type GenerationMode,
  type Project,
  type Scene,
} from "../types";
import { AddButton, Clip, Empty, IconButton, VideoControls } from "./common";

export function Editor({
  project,
  workspace: w,
  settings,
}: {
  project: Project;
  workspace: WorkspaceController;
  settings: () => void;
}) {
  const scenes = w.scenes.filter((s) => s.project_id === project.id);
  const [selectedId, setSelectedId] = useState(scenes[0]?.id || "");
  const [safe, setSafe] = useState(false);
  const [exporting, setExporting] = useState(false);
  const scene = scenes.find((s) => s.id === selectedId) || scenes[0];
  const ready = scenes.filter((s) => sceneBlob(s));
  const pending = scenes.filter(
    (s) => !sceneBlob(s) && s.prompt.trim() && !s.task?.remoteId,
  );
  const version = scene ? activeVersion(scene) : undefined;
  const config = scene ? version?.settings || sceneSettings(scene) : undefined;
  const total = scenes.reduce(
    (sum, s) => sum + (activeVersion(s)?.duration || sceneSettings(s).duration),
    0,
  );
  const busy = !!w.job;
  const add = () =>
    w.action(async () => {
      const added = await db.addScene(
        project.id,
        scene
          ? sceneSettings(scene)
          : {
              model: OMNI_MODEL,
              aspectRatio: "9:16",
              resolution: "720p",
              duration: 8,
            },
      );
      setSelectedId(added.id);
    });
  const move = (offset: number) => {
    if (!scene) return;
    const ids = scenes.map((s) => s.id),
      from = ids.indexOf(scene.id),
      to = from + offset;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void w.action(() => db.reorderScenes(project.id, ids));
  };
  const exportVideo = async () => {
    if (!ready.length) return;
    if (
      ready.length < scenes.length &&
      !window.confirm(
        `Hay ${scenes.length - ready.length} escenas sin vídeo. ¿Exportar solo las ${ready.length} escenas listas?`,
      )
    )
      return;
    setExporting(true);
    try {
      if (ready.length === 1)
        downloadBlob(sceneBlob(ready[0])!, `${project.name}.mp4`);
      else {
        w.notify(
          "Uniendo las escenas en este dispositivo. La primera exportación descarga el motor de vídeo.",
        );
        const { stitchVideos } = await import("../lib/export");
        const blob = await stitchVideos(
          ready.map((s) => sceneBlob(s)!),
          activeVersion(ready[0])?.settings.aspectRatio ||
            sceneSettings(ready[0]).aspectRatio,
        );
        downloadBlob(blob, `${project.name}.mp4`);
      }
      w.notify("Vídeo preparado para descargar.");
    } catch (e) {
      w.notify(
        e instanceof Error
          ? e.message
          : "No se pudo exportar. Descarga los clips por separado.",
        true,
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="editor">
      <div className="editor-top">
        <div className="project-title">
          <input
            key={project.id}
            defaultValue={project.name}
            aria-label="Nombre del proyecto"
            maxLength={80}
            onBlur={(e) => {
              if (!e.target.value.trim()) e.target.value = project.name;
              else
                void w.action(() =>
                  db.renameProject(project.id, e.target.value),
                );
            }}
          />
          <span>
            <Check size={12} />
            Guardado en este navegador
          </span>
        </div>
        <div className="inline">
          <button
            className="button compact"
            disabled={!pending.length || busy}
            onClick={() => void w.run(pending.map((s) => s.id))}
          >
            <Play size={14} />
            Generar pendientes
            {pending.length > 0 && (
              <span className="count">{pending.length}</span>
            )}
          </button>
          <button
            className="button primary compact"
            disabled={!ready.length || exporting || busy}
            onClick={() => void exportVideo()}
          >
            {exporting ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Download size={15} />
            )}
            <span>{exporting ? "Exportando…" : "Exportar vídeo"}</span>
          </button>
        </div>
      </div>
      {scene ? (
        <div className="editor-body">
          <div className="preview-column">
            <div className="preview-heading">
              <span>
                <Film size={14} />
                Vista previa{" "}
                <span className="subtle">
                  / {scene.title || `Escena ${scene.order + 1}`}
                </span>
              </span>
              <button
                className={`text-button ${safe ? "selected-text" : ""}`}
                onClick={() => setSafe(!safe)}
                aria-pressed={safe}
              >
                <Frame size={15} />
                Zona segura
              </button>
            </div>
            <div className="stage">
              <div
                className={`preview-frame ${config?.aspectRatio === "16:9" ? "landscape" : "portrait"}`}
              >
                {sceneBlob(scene) ? (
                  <Clip blob={sceneBlob(scene)} />
                ) : w.assets.find(
                    (a) => a.id === scene.first_frame_asset_id,
                  ) ? (
                  <img
                    src={
                      w.assets.find((a) => a.id === scene.first_frame_asset_id)!
                        .data_url
                    }
                    alt="Fotograma inicial"
                  />
                ) : (
                  <div className="preview-empty">
                    <div className="frame-corners">
                      <Film size={28} strokeWidth={1.2} />
                    </div>
                    <strong>
                      Aquí empieza
                      <br />
                      tu próxima escena.
                    </strong>
                    <p>Describe la toma y dale vida.</p>
                    <span>
                      {sceneSettings(scene).aspectRatio} ·{" "}
                      {sceneSettings(scene).duration} s
                    </span>
                  </div>
                )}
                {safe && (
                  <div className="safe-zone">
                    <span>Mantén aquí lo importante</span>
                  </div>
                )}
                {w.job?.sceneId === scene.id && (
                  <div className="render-overlay">
                    <LoaderCircle className="spin" size={24} />
                    <strong>{w.job.text}</strong>
                    <span>Puedes seguir revisando tus escenas.</span>
                  </div>
                )}
              </div>
            </div>
            <div className="preview-meta">
              <span>
                {version
                  ? `Versión ${scene.versions!.findIndex((v) => v.id === version.id) + 1}`
                  : sceneBlob(scene)
                    ? "Vídeo original"
                    : "Sin generar"}
                <i />
                {config?.resolution}
                <i />
                {version?.duration || config?.duration} s
              </span>
              <button
                className="text-button"
                disabled={!sceneBlob(scene)}
                onClick={() =>
                  downloadBlob(
                    sceneBlob(scene)!,
                    `${project.name}-${scene.title || scene.order + 1}.mp4`,
                  )
                }
              >
                <Download size={14} />
                Descargar clip
              </button>
            </div>
            <div className="storyboard">
              <div className="section-heading">
                <div>
                  <h2>
                    Tu secuencia <span className="count">{scenes.length}</span>
                  </h2>
                  <span>
                    {total} s{" "}
                    {ready.length < scenes.length
                      ? "previstos"
                      : "de secuencia"}{" "}
                    · {ready.length} escenas listas
                  </span>
                </div>
                <AddButton onClick={() => void add()}>Añadir escena</AddButton>
              </div>
              <div className="scene-strip" aria-label="Escenas del proyecto">
                {scenes.map((s, i) => (
                  <button
                    key={s.id}
                    className={`scene-card ${scene.id === s.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedId(s.id)}
                    aria-pressed={scene.id === s.id}
                  >
                    <div className="scene-thumb">
                      {sceneBlob(s) ? (
                        <Clip blob={sceneBlob(s)} controls={false} />
                      ) : w.assets.find(
                          (a) => a.id === s.first_frame_asset_id,
                        ) ? (
                        <img
                          src={
                            w.assets.find(
                              (a) => a.id === s.first_frame_asset_id,
                            )!.data_url
                          }
                          alt=""
                        />
                      ) : (
                        <span className="scene-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      )}
                      <span className="scene-duration">
                        {activeVersion(s)?.duration ||
                          sceneSettings(s).duration}
                        s
                      </span>
                      {w.job?.sceneId === s.id && (
                        <LoaderCircle
                          className="spin scene-processing"
                          size={18}
                        />
                      )}
                    </div>
                    <div className="scene-caption">
                      <strong>{s.title || `Escena ${i + 1}`}</strong>
                      <small
                        className={
                          s.error
                            ? "warning-text"
                            : sceneBlob(s)
                              ? "success-text"
                              : ""
                        }
                      >
                        {s.error
                          ? "Revisar"
                          : sceneBlob(s)
                            ? "Lista"
                            : "Borrador"}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
              <div className="scene-actions">
                <span>
                  Escena {scenes.indexOf(scene) + 1} de {scenes.length}
                </span>
                <div className="inline">
                  <IconButton
                    label="Mover escena a la izquierda"
                    disabled={busy || scenes[0].id === scene.id}
                    onClick={() => move(-1)}
                  >
                    <ArrowLeft size={15} />
                  </IconButton>
                  <IconButton
                    label="Mover escena a la derecha"
                    disabled={busy || scenes.at(-1)?.id === scene.id}
                    onClick={() => move(1)}
                  >
                    <ArrowRight size={15} />
                  </IconButton>
                  <IconButton
                    label="Duplicar escena"
                    disabled={busy}
                    onClick={() =>
                      void w.action(async () => {
                        const copy = await db.duplicateScene(scene.id);
                        setSelectedId(copy.id);
                      })
                    }
                  >
                    <Copy size={15} />
                  </IconButton>
                  <IconButton
                    label="Eliminar escena"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Eliminar esta escena y sus versiones guardadas?",
                        )
                      )
                        void w.action(() => db.deleteScene(scene.id));
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            </div>
          </div>
          <Inspector
            key={scene.id}
            scene={scene}
            assets={w.assets}
            workspace={w}
            openSettings={settings}
          />
        </div>
      ) : (
        <Empty
          title="La primera escena está por escribir"
          action={
            <AddButton onClick={() => void add()}>Añadir escena</AddButton>
          }
        >
          Añade una toma para empezar a construir tu historia.
        </Empty>
      )}
    </div>
  );
}

function Inspector({
  scene,
  assets,
  workspace: w,
  openSettings,
}: {
  scene: Scene;
  assets: Asset[];
  workspace: WorkspaceController;
  openSettings: () => void;
}) {
  const [prompt, setPrompt] = useState(scene.prompt);
  const [title, setTitle] = useState(
    scene.title || `Escena ${scene.order + 1}`,
  );
  const [mode, setMode] = useState<GenerationMode>("generate");
  const [instruction, setInstruction] = useState("");
  const [uploading, setUploading] = useState(false);
  const version = activeVersion(scene),
    config = sceneSettings(scene),
    busy = !!w.job;
  const editable =
    !!version?.interactionId && version.settings.model === OMNI_MODEL;
  const save = (patch: Partial<Scene>) => {
    void w.patch(scene.id, patch).catch((e) => w.notify(e.message, true));
  };
  const upload = async (file: File, role: "first" | "last" | "reference") => {
    setUploading(true);
    try {
      const asset = await storeImage(file, file.name);
      await w.patch(
        scene.id,
        role === "first"
          ? { first_frame_asset_id: asset.id }
          : role === "last"
            ? { last_frame_asset_id: asset.id }
            : {
                reference_asset_ids: [
                  ...(scene.reference_asset_ids || []),
                  asset.id,
                ],
              },
      );
      await w.refresh();
    } catch (e) {
      w.notify(
        e instanceof Error ? e.message : "No se pudo subir la imagen.",
        true,
      );
    } finally {
      setUploading(false);
    }
  };
  const currentJob = w.job?.sceneId === scene.id;
  const needsRecovery = !!scene.task?.remoteId;
  const generate = async () => {
    try {
      await w.patch(scene.id, { prompt, title });
      await w.run([scene.id], mode, instruction);
    } catch (e) {
      w.notify(
        e instanceof Error ? e.message : "No se pudo guardar el prompt.",
        true,
      );
    }
  };
  return (
    <aside className="inspector" aria-label="Configurar escena">
      <div className="inspector-heading">
        <span>Dirección de escena</span>
        <WandSparkles size={16} />
      </div>
      <div className="inspector-content">
        <label>
          Nombre de la escena
          <input
            value={title}
            maxLength={60}
            disabled={busy}
            onChange={(e) => {
              setTitle(e.target.value);
              save({ title: e.target.value });
            }}
          />
        </label>
        <div className="segmented" aria-label="Modo de generación">
          {(["generate", "edit", "extend"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              disabled={
                busy ||
                (m !== "generate" &&
                  (!editable || (m === "extend" && version!.duration > 30)))
              }
              title={
                m !== "generate" && !editable
                  ? "Genera un vídeo con Omni para activar esta opción"
                  : undefined
              }
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m === "generate"
                ? "Crear"
                : m === "edit"
                  ? "Editar"
                  : "Extender"}
            </button>
          ))}
        </div>
        <label>
          {mode === "generate"
            ? "¿Qué ocurre en esta toma?"
            : mode === "edit"
              ? "¿Qué quieres cambiar?"
              : "¿Cómo continúa la escena?"}
          <textarea
            className="prompt-input"
            rows={7}
            value={mode === "generate" ? prompt : instruction}
            disabled={busy}
            placeholder={
              mode === "generate"
                ? "Sujeto, acción, cámara, luz y sonido. Cuanto más clara sea la idea, mejor."
                : mode === "edit"
                  ? "Cambia la luz por un atardecer. Mantén todo lo demás igual."
                  : "La cámara retrocede y revela el paisaje. Continúa la música."
            }
            onChange={(e) => {
              if (mode === "generate") {
                setPrompt(e.target.value);
                save({ prompt: e.target.value });
              } else setInstruction(e.target.value);
            }}
            onKeyDown={(e) => {
              if (
                (e.ctrlKey || e.metaKey) &&
                e.key === "Enter" &&
                !busy &&
                !needsRecovery
              ) {
                e.preventDefault();
                void generate();
              }
            }}
          />
        </label>
        {mode === "generate" ? (
          <>
            <div className="prompt-assist">
              <span>Completa tu dirección</span>
              <select
                aria-label="Añadir indicación al prompt"
                value=""
                disabled={busy}
                onChange={(e) => {
                  const next = `${prompt.trim()} ${e.target.value}`.trim();
                  setPrompt(next);
                  save({ prompt: next });
                }}
              >
                <option value="" disabled>
                  Cámara, luz o sonido…
                </option>
                <option>Una sola toma continua, sin cortes.</option>
                <option>La cámara se acerca suavemente al sujeto.</option>
                <option>Luz natural suave, colores fieles.</option>
                <option>Sonidos ambientales, sin diálogo.</option>
                <option>Sin texto en pantalla.</option>
              </select>
            </div>
            <section className="reference-section">
              <div className="section-heading">
                <h3>Referencias</h3>
                <span>Opcional</span>
              </div>
              <div className="keyframe-grid">
                {(["first", "last"] as const).map((role) => {
                  const id =
                      role === "first"
                        ? scene.first_frame_asset_id
                        : scene.last_frame_asset_id,
                    asset = assets.find((a) => a.id === id),
                    label =
                      role === "first"
                        ? "Fotograma inicial"
                        : "Fotograma final";
                  return (
                    <div className="keyframe" key={role}>
                      <div className="keyframe-picture">
                        {asset ? (
                          <img src={asset.data_url} alt={label} />
                        ) : (
                          <ImagePlus size={20} strokeWidth={1.4} />
                        )}
                        <label className="file-target">
                          <input
                            type="file"
                            aria-label={`Subir ${label.toLowerCase()}`}
                            accept="image/png,image/jpeg,image/webp"
                            disabled={
                              busy ||
                              uploading ||
                              (role === "last" && !scene.first_frame_asset_id)
                            }
                            onChange={(e) => {
                              if (e.target.files?.[0])
                                void upload(e.target.files[0], role);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {asset && (
                          <IconButton
                            label={`Quitar ${label.toLowerCase()}`}
                            disabled={busy}
                            onClick={() =>
                              save(
                                role === "first"
                                  ? {
                                      first_frame_asset_id: undefined,
                                      last_frame_asset_id: undefined,
                                    }
                                  : { last_frame_asset_id: undefined },
                              )
                            }
                          >
                            <X size={12} />
                          </IconButton>
                        )}
                      </div>
                      <select
                        aria-label={label}
                        disabled={
                          busy ||
                          (role === "last" && !scene.first_frame_asset_id)
                        }
                        value={id || ""}
                        onChange={(e) =>
                          save(
                            role === "first"
                              ? {
                                  first_frame_asset_id:
                                    e.target.value || undefined,
                                  ...(!e.target.value
                                    ? { last_frame_asset_id: undefined }
                                    : {}),
                                }
                              : {
                                  last_frame_asset_id:
                                    e.target.value || undefined,
                                },
                          )
                        }
                      >
                        <option value="">{label}</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.file_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              {config.model === OMNI_MODEL && (
                <>
                  <div className="ref-chips">
                    {(scene.reference_asset_ids || []).map((id) => {
                      const a = assets.find((a) => a.id === id);
                      return a ? (
                        <span key={id}>
                          <img src={a.data_url} alt="" />
                          {a.file_name}
                          <IconButton
                            label={`Quitar referencia ${a.file_name}`}
                            disabled={busy}
                            onClick={() =>
                              save({
                                reference_asset_ids:
                                  scene.reference_asset_ids?.filter(
                                    (r) => r !== id,
                                  ),
                              })
                            }
                          >
                            <X size={12} />
                          </IconButton>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <select
                    aria-label="Añadir referencia de personaje o estilo"
                    value=""
                    disabled={
                      busy || (scene.reference_asset_ids?.length || 0) >= 3
                    }
                    onChange={(e) =>
                      save({
                        reference_asset_ids: [
                          ...(scene.reference_asset_ids || []),
                          e.target.value,
                        ],
                      })
                    }
                  >
                    <option value="" disabled>
                      + Personaje, producto o estilo
                    </option>
                    {assets
                      .filter((a) => !scene.reference_asset_ids?.includes(a.id))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.file_name}
                        </option>
                      ))}
                  </select>
                  <label className="text-button upload-reference">
                    <Plus size={13} />
                    Subir referencia
                    <input
                      type="file"
                      aria-label="Subir referencia de personaje o estilo"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={
                        busy ||
                        uploading ||
                        (scene.reference_asset_ids?.length || 0) >= 3
                      }
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          void upload(e.target.files[0], "reference");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </>
              )}
              <small className="subtle">
                JPG, PNG o WebP · hasta 5 MB por imagen
              </small>
            </section>
            <VideoControls
              value={config}
              disabled={busy}
              onChange={(settings) =>
                save({
                  settings,
                  ...(settings.model !== OMNI_MODEL
                    ? { reference_asset_ids: [] }
                    : {}),
                })
              }
            />
          </>
        ) : (
          <p className="hint">
            {mode === "edit"
              ? "Crea una nueva versión a partir de la toma seleccionada. La original se conserva."
              : `Añade 10 segundos al vídeo seleccionado: ${version?.duration || 0} → ${(version?.duration || 0) + 10} s. Máximo 40 s.`}
          </p>
        )}
        {!!scene.versions?.length && (
          <details className="versions">
            <summary>
              <History size={15} />
              Versiones <span className="count">{scene.versions.length}</span>
              <ChevronDown size={14} />
            </summary>
            <div>
              {scene.versions.map((v, i) => (
                <button
                  key={v.id}
                  className={v.id === version?.id ? "selected-version" : ""}
                  disabled={busy}
                  onClick={() => save({ active_version_id: v.id })}
                >
                  <span>
                    V{i + 1}
                    <small>
                      {v.mode === "edit"
                        ? "Edición"
                        : v.mode === "extend"
                          ? "Extensión"
                          : "Generación"}{" "}
                      · {v.duration}s
                    </small>
                  </span>
                  <span>
                    {v.id === version?.id ? <Check size={15} /> : "Usar"}
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}
        {scene.error && (
          <div className="inline-error" role="alert">
            {scene.error}
          </div>
        )}
      </div>
      <div className="generate-footer">
        {currentJob ? (
          <button className="button full" onClick={w.pause}>
            <Pause size={16} />
            Pausar seguimiento
          </button>
        ) : needsRecovery ? (
          <>
            <button
              className="button primary full"
              disabled={busy}
              onClick={() =>
                void w.run([scene.id], "generate", undefined, true)
              }
            >
              <RotateCcw size={16} />
              Recuperar resultado
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Google puede seguir procesando esta solicitud. ¿Dejar de recuperarla y permitir una nueva generación?",
                  )
                )
                  save({
                    task: undefined,
                    status: sceneBlob(scene) ? "completed" : "pending",
                    error: undefined,
                  });
              }}
            >
              Descartar seguimiento
            </button>
          </>
        ) : (
          <button
            className="button primary full"
            disabled={
              busy ||
              uploading ||
              !(mode === "generate" ? prompt : instruction).trim()
            }
            onClick={() => void generate()}
          >
            <WandSparkles size={17} />
            {mode === "edit"
              ? "Crear versión editada"
              : mode === "extend"
                ? "Extender 10 segundos"
                : version
                  ? "Generar otra versión"
                  : "Generar escena"}
            <span className="key-hint" aria-hidden="true">
              ⌘ ↵
            </span>
          </button>
        )}
        <small>Cada generación consume tu cuota de Google.</small>
        <button className="text-button" onClick={openSettings}>
          Configurar mi API key
        </button>
      </div>
    </aside>
  );
}
