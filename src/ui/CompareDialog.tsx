import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { sceneBlob, type Scene } from "../types";
import { useBlobUrl } from "../lib/useBlobUrl";
import { StudioDialog } from "./StudioDialog";
export function CompareDialog({
  clips,
  onClose,
  markFavorite,
}: {
  clips: [Scene, Scene];
  onClose: () => void;
  markFavorite: (id: string, favorite: boolean) => void;
}) {
  const urls = [
    useBlobUrl(sceneBlob(clips[0])),
    useBlobUrl(sceneBlob(clips[1])),
  ];
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [durations, setDurations] = useState([0, 0]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState("none");
  const [error, setError] = useState("");
  const length = Math.max(...durations);
  const ready = durations.every((n) => Number.isFinite(n) && n > 0);
  const seek = (next: number) => {
    setTime(next);
    videos.current.forEach((video, i) => {
      if (video) {
        if (playing)
          void video
            .play()
            .catch(() => setError("No se pudo reanudar este vídeo."));
        video.currentTime = Math.min(next, Math.max(0, durations[i] - 0.001));
      }
    });
  };
  useEffect(() => {
    if (!playing || !ready) return;
    const elements = videos.current.filter((v): v is HTMLVideoElement => !!v);
    const masterIndex = durations[1] > durations[0] ? 1 : 0;
    const master = elements[masterIndex];
    let frame = 0,
      stopped = false;
    const tick = () => {
      if (stopped) return;
      setTime(master.currentTime);
      elements.forEach((video, i) => {
        if (i === masterIndex) return;
        const target = Math.min(master.currentTime, durations[i] - 0.001);
        if (Math.abs(video.currentTime - target) > 0.12)
          video.currentTime = target;
      });
      if (master.ended) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    void Promise.all(elements.map((video) => video.play()))
      .then(() => {
        if (!stopped) frame = requestAnimationFrame(tick);
        else elements.forEach((v) => v.pause());
      })
      .catch(() => {
        if (!stopped) {
          setPlaying(false);
          setError(
            "No se pudieron reproducir ambos vídeos. Intenta reproducir de nuevo.",
          );
        }
      });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      elements.forEach((video) => video.pause());
    };
  }, [playing, ready, durations]);
  return (
    <StudioDialog title="Comparar clips" wide onClose={onClose}>
      <div className="compare-grid">
        {clips.map((scene, i) => (
          <section key={scene.id} className="compare-side">
            <h3>{scene.title}</h3>
            <video
              ref={(element) => {
                videos.current[i] = element;
              }}
              src={urls[i]}
              playsInline
              muted={audio !== String(i)}
              preload="auto"
              onLoadedMetadata={(e) => {
                const duration = e.currentTarget.duration;
                setDurations((current) =>
                  current.map((n, index) => (index === i ? duration : n)),
                );
              }}
              onError={() => {
                setPlaying(false);
                setError("No se pudo abrir uno de los vídeos.");
              }}
            />
            <button
              className="text-button"
              aria-pressed={scene.review === "favorite"}
              onClick={() =>
                markFavorite(scene.id, scene.review !== "favorite")
              }
            >
              {scene.review === "favorite" ? "★ Favorito" : "☆ Marcar favorito"}
            </button>
          </section>
        ))}
      </div>
      <div className="compare-controls">
        <button
          className="button"
          disabled={!ready}
          onClick={() => {
            setError("");
            if (time >= length - 0.05) seek(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? "Pausar ambos" : "Reproducir ambos"}
        </button>
        <button
          className="icon-button"
          aria-label="Volver al inicio"
          disabled={!ready}
          onClick={() => seek(0)}
        >
          <RotateCcw size={17} />
        </button>
        <label>
          Audio
          <select
            aria-label="Audio"
            value={audio}
            onChange={(e) => setAudio(e.target.value)}
          >
            <option value="none">Sin sonido</option>
            <option value="0">Clip izquierdo</option>
            <option value="1">Clip derecho</option>
          </select>
        </label>
      </div>
      <label className="compare-timeline">
        Posición compartida · {time.toFixed(1)} / {length.toFixed(1)} s
        <input
          type="range"
          min={0}
          max={length || 1}
          step={0.01}
          value={Math.min(time, length)}
          disabled={!ready}
          onChange={(e) => seek(Number(e.target.value))}
        />
      </label>
      <p className="hint">
        La reproducción y el desplazamiento se sincronizan. Si un clip es más
        corto, conserva su último fotograma mientras continúa el otro.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </StudioDialog>
  );
}
