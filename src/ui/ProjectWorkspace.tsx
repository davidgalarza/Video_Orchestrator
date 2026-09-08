import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Film,
  Layers,
  LoaderCircle,
  Play,
  Plus,
  Search,
} from "lucide-react";
import {
  activeVersion,
  sceneBlob,
  sceneSettings,
  sequenceScenes,
  type Project,
} from "../types";
import type { WorkspaceController } from "../lib/useWorkspace";
import * as db from "../lib/storage";
import { getDefaults } from "../lib/settings";
import { downloadBlob } from "../lib/media";
import { archiveClips, clipFilename } from "../lib/archive";
import { Clip, Empty, IconButton } from "./common";
import { Editor } from "./Editor";

export function ProjectWorkspace({
  project,
  workspace: w,
  settings,
}: {
  project: Project;
  workspace: WorkspaceController;
  settings: () => void;
}) {
  const [view, setView] = useState<"clips" | "edit" | "sequence">("clips");
  const [editing, setEditing] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [packing, setPacking] = useState(false);
  const scenes = w.scenes.filter((s) => s.project_id === project.id);
  const sequence = sequenceScenes(project, scenes);
  const selected = scenes.filter((s) => selection.includes(s.id));
  const selectedReady = selected.filter((s) => sceneBlob(s));
  const visible = scenes.filter(
    (s) =>
      `${s.title || ""} ${s.prompt}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (filter === "all" ||
        (filter === "ready" ? !!sceneBlob(s) : !sceneBlob(s))),
  );
  const pending = scenes.filter(
    (s) => !sceneBlob(s) && s.prompt.trim() && !s.task?.remoteId,
  );
  const openClip = (id: string) => {
    setEditing(id);
    setView("edit");
  };
  const add = () =>
    void w.action(async () => {
      const scene = await db.addScene(project.id, getDefaults());
      openClip(scene.id);
    });
  const addToSequence = () =>
    void w.action(async () => {
      await db.saveSequence(project.id, [
        ...new Set([
          ...sequence.map((s) => s.id),
          ...selected.map((s) => s.id),
        ]),
      ]);
      setSelection([]);
      setView("sequence");
    });
  const zip = async () => {
    setPacking(true);
    try {
      downloadBlob(
        await archiveClips(selectedReady),
        `${project.name}-clips.zip`,
      );
      w.notify(
        `${selectedReady.length} vídeos preparados en ZIP, con sus prompts en clips.json.`,
      );
    } catch (e) {
      w.notify(
        e instanceof Error
          ? e.message
          : "No se pudo preparar el ZIP. Descarga menos clips a la vez.",
        true,
      );
    } finally {
      setPacking(false);
    }
  };
  if (view !== "clips")
    return (
      <>
        <div className="workspace-navigation">
          <button className="text-button" onClick={() => setView("clips")}>
            <ArrowLeft size={16} /> Todos los clips
          </button>
          <span>
            {view === "sequence" ? "Montaje de secuencia" : "Editar clip"}
          </span>
        </div>
        <Editor
          key={`${view}-${editing}`}
          project={project}
          workspace={w}
          settings={settings}
          initialSceneId={editing}
          sequenceMode={view === "sequence"}
          browseClips={() => setView("clips")}
        />
      </>
    );
  return (
    <div className="project-clips">
      <div className="editor-top">
        <div className="project-title">
          <input
            aria-label="Nombre del proyecto"
            defaultValue={project.name}
            maxLength={80}
            onBlur={(e) => {
              if (e.target.value.trim())
                void w.action(() =>
                  db.renameProject(project.id, e.target.value),
                );
              else e.target.value = project.name;
            }}
          />
          <span>
            <Check size={12} /> Guardado en este navegador
          </span>
        </div>
        <div className="inline">
          <button
            className="button compact"
            onClick={() => setView("sequence")}
          >
            <Layers size={15} />
            {sequence.length
              ? `Secuencia · ${sequence.length}`
              : "Montar secuencia"}
          </button>
          <button className="button primary compact" onClick={add}>
            <Plus size={15} /> Nuevo clip
          </button>
        </div>
      </div>
      <div className="clips-content">
        <header className="clips-heading">
          <div>
            <h1>
              Clips del proyecto <span className="count">{scenes.length}</span>
            </h1>
            <p>
              Genera, compara versiones y descarga cada vídeo para seguir
              editando.
            </p>
          </div>
          <button
            className="button compact"
            disabled={!pending.length || !!w.job}
            onClick={() => void w.run(pending.map((s) => s.id))}
          >
            <Play size={14} /> Generar pendientes{" "}
            {pending.length > 0 && (
              <span className="count">{pending.length}</span>
            )}
          </button>
        </header>
        <div className="clips-filters">
          <label className="search">
            <Search size={16} />
            <input
              aria-label="Buscar clips"
              placeholder="Buscar por nombre o prompt"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="clip-filter">
            Mostrar
            <select
              aria-label="Filtrar clips"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Todos los clips</option>
              <option value="ready">Con vídeo</option>
              <option value="drafts">Sin vídeo</option>
            </select>
          </label>
        </div>
        <div className="clip-selection-bar" aria-label="Acciones de selección">
          <label className="clip-check">
            <input
              type="checkbox"
              aria-label="Seleccionar clips visibles"
              checked={
                visible.length > 0 &&
                visible.every((s) => selection.includes(s.id))
              }
              disabled={!visible.length}
              onChange={(e) =>
                setSelection(
                  e.target.checked
                    ? [...new Set([...selection, ...visible.map((s) => s.id)])]
                    : selection.filter(
                        (id) => !visible.some((s) => s.id === id),
                      ),
                )
              }
            />
            {selected.length
              ? `${selected.length} seleccionados`
              : "Seleccionar"}
          </label>
          {selected.length > 0 && (
            <button className="text-button" onClick={() => setSelection([])}>
              Deseleccionar
            </button>
          )}
          <div className="selection-actions">
            <button
              className="button compact"
              disabled={!selected.length || packing}
              onClick={addToSequence}
            >
              <Layers size={14} /> Añadir a secuencia
            </button>
            <button
              className="button compact"
              disabled={!selectedReady.length || packing}
              onClick={() => void zip()}
            >
              {packing ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <Download size={14} />
              )}
              {packing
                ? "Preparando ZIP…"
                : `Descargar seleccionados${selectedReady.length ? ` (${selectedReady.length})` : ""} · ZIP`}
            </button>
          </div>
        </div>
        {selected.length > selectedReady.length && (
          <p className="selection-note">
            El ZIP incluirá solo los {selectedReady.length} clips seleccionados
            que tienen vídeo.
          </p>
        )}
        {visible.length ? (
          <div className="clip-grid">
            {visible.map((scene) => {
              const version = activeVersion(scene),
                blob = sceneBlob(scene);
              const versionNumber = version
                ? (scene.versions?.findIndex((v) => v.id === version.id) ?? 0) +
                  1
                : 1;
              const references = [
                ...new Set(
                  [
                    scene.first_frame_asset_id,
                    scene.last_frame_asset_id,
                    ...(scene.reference_asset_ids || []),
                  ].filter(Boolean),
                ),
              ];
              return (
                <article
                  className={`project-clip ${selection.includes(scene.id) ? "is-checked" : ""}`}
                  key={scene.id}
                >
                  <div className="clip-media">
                    <button
                      className="clip-open"
                      aria-label={`Abrir clip: ${scene.title || "Sin título"}`}
                      onClick={() => openClip(scene.id)}
                    >
                      <Clip
                        blob={blob}
                        poster={
                          w.assets.find(
                            (a) => a.id === scene.first_frame_asset_id,
                          )?.data_url
                        }
                        controls={false}
                      />
                      <span className="clip-open-label">Abrir editor</span>
                    </button>
                    <label className="clip-checkbox">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar clip: ${scene.title || "Sin título"}`}
                        checked={selection.includes(scene.id)}
                        onChange={(e) =>
                          setSelection(
                            e.target.checked
                              ? [...selection, scene.id]
                              : selection.filter((id) => id !== scene.id),
                          )
                        }
                      />
                    </label>
                    {blob && (
                      <span className="clip-version">
                        V{versionNumber} ·{" "}
                        {version?.duration || sceneSettings(scene).duration} s
                      </span>
                    )}
                  </div>
                  <div className="clip-info">
                    <div className="clip-title">
                      <button onClick={() => openClip(scene.id)}>
                        {scene.title || "Clip sin título"}
                      </button>
                      <span
                        className={
                          scene.error
                            ? "warning-text"
                            : blob
                              ? "success-text"
                              : "subtle"
                        }
                      >
                        {w.job?.sceneId === scene.id
                          ? "Generando…"
                          : scene.error
                            ? "Revisar"
                            : blob
                              ? "Listo"
                              : "Borrador"}
                      </span>
                    </div>
                    <p className="clip-prompt">
                      {version?.prompt ||
                        scene.prompt ||
                        "Escribe un prompt para generar este clip."}
                    </p>
                    <div className="clip-details">
                      <span>
                        {references.length} referencias ·{" "}
                        {scene.versions?.length || (blob ? 1 : 0)} versiones
                      </span>
                      <IconButton
                        label={`Descargar clip: ${scene.title || "Sin título"}`}
                        disabled={!blob}
                        onClick={() => downloadBlob(blob!, clipFilename(scene))}
                      >
                        <Download size={16} />
                      </IconButton>
                    </div>
                    {sequence.some((s) => s.id === scene.id) && (
                      <span className="clip-in-sequence">
                        <Film size={12} /> En la secuencia
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            title={
              scenes.length
                ? "No hay coincidencias"
                : "Este proyecto aún no tiene clips"
            }
            action={
              !scenes.length ? (
                <button className="button" onClick={add}>
                  <Plus size={16} /> Nuevo clip
                </button>
              ) : undefined
            }
          >
            {scenes.length
              ? "Cambia la búsqueda o el filtro para ver otros clips."
              : "Añade un clip y describe el vídeo que quieres generar."}
          </Empty>
        )}
      </div>
    </div>
  );
}
