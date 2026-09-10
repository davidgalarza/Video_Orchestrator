import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Film,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  SkipBack,
  Trash2,
  Undo2,
  Volume2,
} from "lucide-react";
import {
  sceneBlob,
  type AspectRatio,
  type Project,
  type Scene,
  type SequenceItem,
} from "../types";
import {
  clipAtTime,
  FRAME,
  makeSequenceItem,
  projectSequence,
  resolveTimeline,
  sourceKey,
  splitSequence,
  timecode,
  type TimelineClip,
} from "../lib/timeline";
import { saveMontage } from "../lib/storage";
import type { WorkspaceController } from "../lib/useWorkspace";
import { useBlobUrl } from "../lib/useBlobUrl";
import { Clip } from "./common";
import { VideoDownloadDialog, type VideoDownload } from "./VideoDownloadDialog";
import "./sequence.css";

type Edit = { items: SequenceItem[]; aspect: AspectRatio };
function SourceProbe({
  clip,
  onDuration,
}: {
  clip: TimelineClip;
  onDuration: (key: string, duration: number) => void;
}) {
  const url = useBlobUrl(clip.blob);
  return url ? (
    <video
      hidden
      src={url}
      preload="metadata"
      onLoadedMetadata={(e) => {
        const duration = e.currentTarget.duration;
        if (Number.isFinite(duration) && duration > 0)
          onDuration(sourceKey(clip), duration);
      }}
    />
  ) : null;
}
function PreviewVideo({
  clip,
  active,
  playing,
  time,
  seekToken,
  onTime,
  onEnd,
  onError,
}: {
  clip: TimelineClip;
  active: boolean;
  playing: boolean;
  time: number;
  seekToken: number;
  onTime: (n: number) => void;
  onEnd: () => void;
  onError: () => void;
}) {
  const url = useBlobUrl(clip.blob);
  const ref = useRef<HTMLVideoElement>(null);
  const latest = useRef({ time, onTime, onEnd, clip });
  useEffect(() => {
    latest.current = { time, onTime, onEnd, clip };
  });
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const sync = () => {
      if (!active) {
        video.pause();
        return;
      }
      const c = latest.current.clip;
      video.currentTime = Math.min(
        c.out,
        Math.max(c.in, c.in + latest.current.time - c.start),
      );
      video.volume = c.volume;
      if (playing) void video.play().catch(onError);
      else video.pause();
    };
    sync();
    video.addEventListener("loadedmetadata", sync);
    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.pause();
    };
  }, [
    active,
    playing,
    seekToken,
    url,
    clip.in,
    clip.out,
    clip.volume,
    onError,
  ]);
  useEffect(() => {
    if (!active || !playing) return;
    let frame = 0;
    const tick = () => {
      const video = ref.current,
        c = latest.current.clip;
      if (video && !video.seeking) {
        if (video.ended || video.currentTime >= c.out - 0.012) {
          latest.current.onEnd();
          return;
        }
        if (!video.paused)
          latest.current.onTime(
            c.start + Math.max(0, video.currentTime - c.in),
          );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, playing, seekToken, clip.in, clip.out]);
  return (
    <video
      ref={ref}
      src={url}
      hidden={!active}
      playsInline
      preload="auto"
      data-testid={active ? "sequence-preview" : "sequence-preload"}
      onError={active ? onError : undefined}
      onEnded={() => {
        if (active && playing) onEnd();
      }}
    />
  );
}
export function SequenceEditor({
  project,
  workspace: w,
  onBack,
}: {
  project: Project;
  workspace: WorkspaceController;
  onBack: () => void;
}) {
  const scenes = w.scenes.filter(
    (s) => s.project_id === project.id && !s.deleted_at,
  );
  const [edit, setEdit] = useState<Edit>(() => ({
    items: projectSequence(project, scenes),
    aspect: project.sequence_aspect || "9:16",
  }));
  const [draft, setDraft] = useState<SequenceItem[]>();
  const [past, setPast] = useState<Edit[]>([]),
    [future, setFuture] = useState<Edit[]>([]);
  const [selected, setSelected] = useState("");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [position, setPosition] = useState(0),
    [playing, setPlaying] = useState(false),
    [seekToken, setSeekToken] = useState(0);
  const [zoom, setZoom] = useState(72),
    [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState("Guardado"),
    [error, setError] = useState("");
  const [download, setDownload] = useState<VideoDownload>();
  const saveQueue = useRef(Promise.resolve()),
    revision = useRef(0);
  const saveFailed = useRef(false);
  const scroll = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    side: "in" | "out";
    x: number;
    clip: TimelineClip;
    original: SequenceItem[];
    next: SequenceItem[];
  } | null>(null);
  const clips = resolveTimeline(draft || edit.items, scenes, durations);
  const total = clips.reduce((sum, c) => sum + c.length, 0);
  const time = Math.min(position, total);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const x = time * zoom;
    if (
      x < element.scrollLeft ||
      x > element.scrollLeft + element.clientWidth - 70
    )
      element.scrollLeft = Math.max(0, x - element.clientWidth / 3);
  }, [time, zoom]);
  const current = clipAtTime(clips, time),
    chosen = clips.find((c) => c.id === selected);
  const currentIndex = current ? clips.indexOf(current) : -1;
  const ready = scenes.filter((s) => sceneBlob(s));
  const probes = [
    ...new Map(
      [
        ...clips,
        ...resolveTimeline(
          ready.map((s) => makeSequenceItem(s, s.id)),
          scenes,
        ),
      ].map((c) => [sourceKey(c), c]),
    ).values(),
  ];
  const unresolved = clips.some((c) => !c.blob || !durations[sourceKey(c)]);
  function persist(next: Edit) {
    const rev = ++revision.current;
    setSaveState("Guardando…");
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        await saveMontage(project.id, next.items, next.aspect);
        await w.refresh();
        if (revision.current === rev) {
          saveFailed.current = false;
          setSaveState("Guardado");
        }
      })
      .catch(() => {
        if (revision.current === rev) {
          saveFailed.current = true;
          setSaveState("No se pudo guardar");
        }
      });
  }
  function commit(next: Edit) {
    if (JSON.stringify(next) === JSON.stringify(edit)) return;
    setPlaying(false);
    setPast([...past.slice(-49), edit]);
    setFuture([]);
    setEdit(next);
    setDraft(undefined);
    persist(next);
    setSeekToken((n) => n + 1);
  }
  function update(items: SequenceItem[]) {
    commit({ ...edit, items });
  }
  function seek(n: number) {
    setPosition(Math.max(0, Math.min(n, total)));
    setSeekToken((t) => t + 1);
    setError("");
  }
  function undo() {
    const next = past.at(-1);
    if (next) {
      setPlaying(false);
      setPast(past.slice(0, -1));
      setFuture([edit, ...future]);
      setEdit(next);
      persist(next);
      setSeekToken((n) => n + 1);
    }
  }
  function redo() {
    const next = future[0];
    if (next) {
      setPlaying(false);
      setPast([...past, edit]);
      setFuture(future.slice(1));
      setEdit(next);
      persist(next);
      setSeekToken((n) => n + 1);
    }
  }
  function add(scene: Scene, before?: string) {
    const item = makeSequenceItem(scene);
    const items = [...edit.items];
    const index = before ? items.findIndex((i) => i.id === before) : -1;
    items.splice(index < 0 ? items.length : index, 0, item);
    update(items);
    setSelected(item.id);
  }
  function move(id: string, before?: string) {
    if (id === before) return;
    const item = edit.items.find((i) => i.id === id);
    if (!item) return;
    const items = edit.items.filter((i) => i.id !== id);
    const index = before ? items.findIndex((i) => i.id === before) : -1;
    items.splice(index < 0 ? items.length : index, 0, item);
    update(items);
  }
  function nudge(direction: number) {
    if (!chosen) return;
    const index = clips.indexOf(chosen),
      other = index + direction;
    if (other < 0 || other >= clips.length) return;
    const items = [...edit.items];
    [items[index], items[other]] = [items[other], items[index]];
    update(items);
  }
  function patch(id: string, values: Partial<SequenceItem>) {
    update(edit.items.map((i) => (i.id === id ? { ...i, ...values } : i)));
  }
  function duplicate() {
    if (!chosen) return;
    const id = crypto.randomUUID();
    update(
      edit.items.flatMap((i) => (i.id === chosen.id ? [i, { ...i, id }] : [i])),
    );
    setSelected(id);
  }
  function split() {
    if (current) update(splitSequence(edit.items, current, time));
  }
  function remove() {
    if (chosen) update(edit.items.filter((i) => i.id !== chosen.id));
  }
  function togglePlay() {
    if (!clips.length || unresolved) return;
    if (time >= total - FRAME) seek(0);
    setError("");
    setPlaying(!playing);
  }
  // Stable callbacks keep playback running when the global playhead updates.
  const handlers = useRef({ end: () => {}, fail: () => {} });
  useEffect(() => {
    handlers.current = {
      end: () => {
        const next = clips[currentIndex + 1];
        if (next) seek(next.start);
        else {
          setPosition(total);
          setPlaying(false);
        }
      },
      fail: () => {
        setPlaying(false);
        setError(
          "No se pudo reproducir este clip. Prueba de nuevo o retíralo del montaje.",
        );
      },
    };
  });
  const [onEnd] = useState(() => () => handlers.current.end());
  const [onError] = useState(() => () => handlers.current.fail());
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest(
          "input,textarea,select,[contenteditable=true],dialog",
        ) ||
          (e.target.closest("button") &&
            !e.target.closest(".sequence-item-content")) ||
          document.querySelector("dialog[open]"))
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        seek(
          time + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 1 : FRAME),
        );
      } else if (e.key.toLowerCase() === "s") split();
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function trimStart(
    e: PointerEvent<HTMLButtonElement>,
    clip: TimelineClip,
    side: "in" | "out",
  ) {
    e.stopPropagation();
    e.preventDefault();
    setPlaying(false);
    setSelected(clip.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: clip.id,
      side,
      x: e.clientX,
      clip,
      original: edit.items,
      next: edit.items,
    };
  }
  function trimMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.x) / zoom / FRAME) * FRAME;
    const value =
      d.side === "in"
        ? Math.max(0, Math.min(d.clip.out - FRAME, d.clip.in + delta))
        : Math.max(
            d.clip.in + FRAME,
            Math.min(d.clip.sourceDuration, d.clip.out + delta),
          );
    d.next = d.original.map((i) =>
      i.id === d.id
        ? { ...i, in: d.clip.in, out: d.clip.out, [d.side]: value }
        : i,
    );
    setDraft(d.next);
  }
  function trimEnd() {
    const d = drag.current;
    drag.current = null;
    setDraft(undefined);
    if (d) update(d.next);
  }
  function scrub(e: PointerEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - bounds.left) / zoom);
  }
  async function leave() {
    await saveQueue.current;
    if (saveFailed.current) {
      persist(edit);
      return;
    }
    onBack();
  }
  return (
    <section className="sequence-editor" aria-label="Editor de secuencia">
      {probes.map((c) => (
        <SourceProbe
          key={sourceKey(c)}
          clip={c}
          onDuration={(key, duration) =>
            setDurations((prev) =>
              prev[key] === duration ? prev : { ...prev, [key]: duration },
            )
          }
        />
      ))}
      <header className="sequence-header">
        <button className="text-button" onClick={() => void leave()}>
          <ArrowLeft size={16} /> Todos los clips
        </button>
        <div>
          <h1>
            {project.name} <span>/ Secuencia</span>
          </h1>
          <small role="status">{saveState}</small>
          {saveState === "No se pudo guardar" && (
            <button className="text-button" onClick={() => persist(edit)}>
              Reintentar guardado
            </button>
          )}
        </div>
        <button
          className="button primary"
          disabled={!clips.length || unresolved}
          onClick={() => {
            setPlaying(false);
            setDownload({
              blobs: clips.map((c) => c.blob!),
              segments: clips.map((c) => ({
                start: c.in,
                end: c.out,
                volume: c.volume,
              })),
              aspect: edit.aspect,
              title: project.name,
              filename: `${project.name}-secuencia.mp4`,
            });
          }}
        >
          <Download size={16} /> Exportar vídeo
        </button>
      </header>
      <div className="sequence-workbench">
        <aside className="sequence-library">
          <div className="sequence-panel-title">
            <h2>Clips del proyecto</h2>
            <span>{ready.length}</span>
          </div>
          <input
            type="search"
            aria-label="Buscar clips para el montaje"
            placeholder="Buscar clips…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="hint">Arrastra a la línea de tiempo o pulsa +.</p>
          <div className="sequence-source-list">
            {ready
              .filter((s) =>
                `${s.title} ${s.prompt}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((s) => (
                <div
                  className="sequence-source"
                  key={s.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/sequence-source", s.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <Clip blob={sceneBlob(s)} controls={false} />
                  <div>
                    <strong>{s.title || `Clip ${s.order + 1}`}</strong>
                    <small>
                      {timecode(
                        durations[sourceKey(makeSequenceItem(s, s.id))] || 0,
                      )}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Añadir ${s.title || `Clip ${s.order + 1}`} al montaje`}
                    onClick={() => add(s)}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              ))}
          </div>
          {!ready.length && (
            <p className="hint">
              Los vídeos terminados aparecerán aquí. Vuelve a tus clips para
              generar uno.
            </p>
          )}
        </aside>
        <main className="sequence-viewer">
          <div className="sequence-viewer-heading">
            <span>Previsualización</span>
            <select
              aria-label="Formato del montaje"
              value={edit.aspect}
              onChange={(e) =>
                commit({ ...edit, aspect: e.target.value as AspectRatio })
              }
            >
              <option value="9:16">Vertical · 9:16</option>
              <option value="16:9">Horizontal · 16:9</option>
            </select>
          </div>
          <div className="sequence-preview-stage">
            <div
              className="sequence-preview-frame"
              style={{
                aspectRatio: edit.aspect.replace(":", "/"),
                width: `calc(var(--sequence-preview-height) * ${edit.aspect === "9:16" ? 9 / 16 : 16 / 9})`,
              }}
            >
              {current?.blob ? (
                clips
                  .slice(currentIndex, currentIndex + 2)
                  .map((c) => (
                    <PreviewVideo
                      key={c.id}
                      clip={c}
                      active={c.id === current.id}
                      playing={playing}
                      time={time}
                      seekToken={seekToken}
                      onTime={setPosition}
                      onEnd={onEnd}
                      onError={onError}
                    />
                  ))
              ) : (
                <div className="sequence-placeholder">
                  <Film size={32} />
                  <p>
                    {current
                      ? "Este clip aún no tiene un vídeo disponible."
                      : "Tu montaje empieza con un clip."}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="sequence-transport">
            <button
              className="icon-button"
              aria-label="Volver al inicio"
              disabled={!clips.length}
              onClick={() => seek(0)}
            >
              <SkipBack size={18} />
            </button>
            <button
              className="sequence-play"
              aria-label={playing ? "Pausar secuencia" : "Reproducir secuencia"}
              disabled={!clips.length || unresolved}
              onClick={togglePlay}
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <output aria-label="Posición del montaje">
              {timecode(time)} <span>/ {timecode(total)}</span>
            </output>
          </div>
          <input
            className="sequence-seek"
            type="range"
            min={0}
            max={total || 1}
            step={FRAME}
            value={time}
            disabled={!clips.length}
            aria-label="Recorrer secuencia"
            onChange={(e) => seek(Number(e.target.value))}
          />
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </main>
        <aside className="sequence-inspector">
          <h2>
            {chosen
              ? chosen.scene?.title || "Clip seleccionado"
              : "Ajustes del clip"}
          </h2>
          {chosen ? (
            <>
              <p className="hint">Recorta la toma sin cambiar el original.</p>
              <div className="sequence-trim-fields">
                {(["in", "out"] as const).map((side) => (
                  <label key={`${chosen.id}-${side}-${chosen[side]}`}>
                    {side === "in" ? "Inicio (s)" : "Final (s)"}
                    <input
                      aria-label={
                        side === "in"
                          ? "Inicio del recorte"
                          : "Final del recorte"
                      }
                      type="number"
                      min={side === "in" ? 0 : chosen.in + FRAME}
                      max={
                        side === "in"
                          ? chosen.out - FRAME
                          : chosen.sourceDuration
                      }
                      step={FRAME}
                      defaultValue={Number(chosen[side].toFixed(3))}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (!e.target.value || !Number.isFinite(value)) {
                          e.target.value = chosen[side].toFixed(3);
                          return;
                        }
                        const clamped =
                          side === "in"
                            ? Math.max(0, Math.min(value, chosen.out - FRAME))
                            : Math.max(
                                chosen.in + FRAME,
                                Math.min(value, chosen.sourceDuration),
                              );
                        patch(chosen.id, {
                          in: chosen.in,
                          out: chosen.out,
                          [side]: clamped,
                        });
                        e.target.value = clamped.toFixed(3);
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="sequence-duration">
                {timecode(chosen.length)}{" "}
                <span>de {timecode(chosen.sourceDuration)}</span>
              </p>
              <button
                className="text-button"
                onClick={() => patch(chosen.id, { in: 0, out: undefined })}
              >
                Restablecer recorte
              </button>
              <label className="sequence-volume">
                <span>
                  <Volume2 size={16} /> Audio{" "}
                  <strong>{Math.round(chosen.volume * 100)}%</strong>
                </span>
                <input
                  type="range"
                  aria-label="Volumen del clip"
                  min={0}
                  max={100}
                  value={chosen.volume * 100}
                  onChange={(e) =>
                    patch(chosen.id, { volume: Number(e.target.value) / 100 })
                  }
                />
              </label>
              <button
                className="text-button"
                onClick={() =>
                  patch(chosen.id, { volume: chosen.volume ? 0 : 1 })
                }
              >
                {chosen.volume ? "Silenciar clip" : "Activar audio"}
              </button>
              <div className="sequence-inspector-actions">
                <button
                  className="button"
                  disabled={clips.indexOf(chosen) === 0}
                  onClick={() => nudge(-1)}
                >
                  <ArrowLeft size={15} /> Antes
                </button>
                <button
                  className="button"
                  disabled={clips.indexOf(chosen) === clips.length - 1}
                  onClick={() => nudge(1)}
                >
                  Después <ArrowRight size={15} />
                </button>
                <button className="button" onClick={duplicate}>
                  <Copy size={15} /> Duplicar
                </button>
                <button className="button" onClick={remove}>
                  <Trash2 size={15} /> Quitar
                </button>
              </div>
            </>
          ) : (
            <p className="hint">
              Selecciona una toma en la línea de tiempo para ajustar sus
              recortes y su audio.
            </p>
          )}
        </aside>
      </div>
      <section className="sequence-timeline" aria-label="Línea de tiempo">
        <div className="sequence-timeline-toolbar">
          <div>
            <button
              className="icon-button"
              aria-label="Deshacer"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Rehacer"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
            <button
              className="button"
              disabled={
                !current ||
                time - current.start < FRAME ||
                current.start + current.length - time < FRAME
              }
              onClick={split}
            >
              <Scissors size={16} /> Dividir aquí
            </button>
          </div>
          <span>
            {clips.length} {clips.length === 1 ? "clip" : "clips"} ·{" "}
            {timecode(total)}
          </span>
          <div className="sequence-zoom">
            <button
              className="text-button"
              disabled={!total}
              onClick={() =>
                setZoom(
                  Math.max(
                    4,
                    Math.min(
                      240,
                      ((scroll.current?.clientWidth || 800) - 80) / total,
                    ),
                  ),
                )
              }
            >
              Ajustar
            </button>
            <label>
              Zoom
              <input
                type="range"
                aria-label="Zoom de la línea de tiempo"
                min={4}
                max={240}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
          </div>
        </div>
        <div className="sequence-timeline-scroll" ref={scroll}>
          <div
            className="sequence-timeline-track"
            style={{ width: Math.max(600, total * zoom + 100) }}
          >
            <div
              className="sequence-ruler"
              role="slider"
              tabIndex={0}
              aria-label="Cursor de la línea de tiempo"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={time}
              aria-valuetext={timecode(time)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrub(e);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e);
              }}
              onKeyDown={(e) => {
                if (e.key === "Home") seek(0);
                if (e.key === "End") seek(total);
              }}
            >
              {Array.from(
                { length: Math.ceil(total / (zoom < 50 ? 5 : 1)) + 1 },
                (_, i) => {
                  const second = i * (zoom < 50 ? 5 : 1);
                  return (
                    <span key={i} style={{ left: second * zoom }}>
                      {timecode(second).slice(0, 5)}
                    </span>
                  );
                },
              )}
            </div>
            <div
              className="sequence-lane"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("application/sequence-item"),
                  scene = scenes.find(
                    (s) =>
                      s.id ===
                      e.dataTransfer.getData("application/sequence-source"),
                  );
                if (id) move(id);
                else if (scene) add(scene);
              }}
            >
              {clips.map((c, index) => (
                <div
                  key={c.id}
                  className={`sequence-item ${selected === c.id ? "selected" : ""} ${!c.blob ? "unavailable" : ""}`}
                  style={{ width: c.length * zoom }}
                  data-testid="timeline-clip"
                  data-clip-id={c.id}
                  draggable
                  onDragStart={(e) => {
                    if (drag.current) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData("application/sequence-item", c.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.dataTransfer.getData(
                        "application/sequence-item",
                      ),
                      scene = scenes.find(
                        (s) =>
                          s.id ===
                          e.dataTransfer.getData("application/sequence-source"),
                      );
                    if (id) move(id, c.id);
                    else if (scene) add(scene, c.id);
                  }}
                >
                  <button
                    className="sequence-item-content"
                    aria-label={`Seleccionar toma ${index + 1}: ${c.scene?.title || "Clip"}`}
                    aria-pressed={selected === c.id}
                    onClick={() => {
                      setSelected(c.id);
                      seek(c.start);
                    }}
                  >
                    <Clip blob={c.blob} controls={false} />
                    <span>
                      <strong>
                        {index + 1}. {c.scene?.title || "Clip"}
                      </strong>
                      <small>
                        {timecode(c.length)}
                        {c.volume === 0 ? " · Sin audio" : ""}
                      </small>
                    </span>
                  </button>
                  {(["in", "out"] as const).map((side) => (
                    <button
                      key={side}
                      className={`sequence-trim-handle ${side}`}
                      aria-label={`Recortar ${side === "in" ? "inicio" : "final"} de toma ${index + 1}`}
                      onPointerDown={(e) => trimStart(e, c, side)}
                      onPointerMove={trimMove}
                      onPointerUp={trimEnd}
                      onPointerCancel={() => {
                        drag.current = null;
                        setDraft(undefined);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                          e.stopPropagation();
                          e.preventDefault();
                          const value =
                            c[side] + (e.key === "ArrowRight" ? FRAME : -FRAME);
                          patch(c.id, {
                            in: c.in,
                            out: c.out,
                            [side]:
                              side === "in"
                                ? Math.max(0, Math.min(c.out - FRAME, value))
                                : Math.max(
                                    c.in + FRAME,
                                    Math.min(c.sourceDuration, value),
                                  ),
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              ))}
              {!clips.length && (
                <div className="sequence-drop-empty">
                  <Plus size={20} /> Añade clips para empezar tu montaje.
                </div>
              )}
            </div>
            {!!clips.length && (
              <div
                className="sequence-playhead"
                style={{ left: time * zoom }}
                aria-hidden="true"
              >
                <i />
              </div>
            )}
          </div>
        </div>
        <footer className="sequence-timeline-hint">
          <span>Arrastra para ordenar · Tira de los bordes para recortar</span>
          <span>Espacio: reproducir · ← →: un fotograma · S: dividir</span>
        </footer>
        {unresolved && !!clips.length && (
          <p className="hint">
            Un clip está pendiente de lectura o no tiene vídeo. Solo se pueden
            reproducir y exportar vídeos disponibles.
          </p>
        )}
      </section>
      {download && (
        <VideoDownloadDialog
          video={download}
          onClose={() => setDownload(undefined)}
        />
      )}
    </section>
  );
}
