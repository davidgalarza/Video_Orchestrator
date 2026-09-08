import { type ReactNode } from "react";
import { useBlobUrl } from "../lib/useBlobUrl";
import { Film, LoaderCircle, Plus, X } from "lucide-react";
import { OMNI_MODEL, VEO_MODEL, type VideoSettings } from "../types";

export function Clip({
  blob,
  poster,
  className = "",
  controls = true,
}: {
  blob?: Blob;
  poster?: string;
  className?: string;
  controls?: boolean;
}) {
  const url = useBlobUrl(blob);
  return url ? (
    <video
      className={className}
      src={url}
      controls={controls}
      playsInline
      preload="metadata"
    />
  ) : poster ? (
    <img className={className} src={poster} alt="Referencia de la escena" />
  ) : (
    <div className={`clip-placeholder ${className}`}>
      <Film size={22} />
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Film size={30} strokeWidth={1.3} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Busy({ children }: { children: ReactNode }) {
  return (
    <span className="inline">
      <LoaderCircle className="spin" size={16} />
      {children}
    </span>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function VideoControls({
  value,
  onChange,
  disabled = false,
}: {
  value: VideoSettings;
  onChange: (v: VideoSettings) => void;
  disabled?: boolean;
}) {
  const omni = value.model === OMNI_MODEL;
  const change = (part: Partial<VideoSettings>) => {
    const next = { ...value, ...part };
    if (next.model === VEO_MODEL) {
      if (!["720p", "1080p"].includes(next.resolution))
        next.resolution = "720p";
      if (![4, 6, 8].includes(next.duration) || next.resolution === "1080p")
        next.duration = 8;
    }
    onChange(next);
  };
  return (
    <fieldset className="video-controls" disabled={disabled}>
      <label>
        Modelo
        <select
          value={value.model}
          onChange={(e) =>
            change({ model: e.target.value as VideoSettings["model"] })
          }
        >
          <option value={OMNI_MODEL}>Gemini Omni 1.1 Flash</option>
          <option value={VEO_MODEL}>Veo 3.1</option>
        </select>
      </label>
      <div className="field-row">
        <label>
          Formato
          <select
            value={value.aspectRatio}
            onChange={(e) =>
              change({
                aspectRatio: e.target.value as VideoSettings["aspectRatio"],
              })
            }
          >
            <option value="9:16">9:16 · Vertical</option>
            <option value="16:9">16:9 · Horizontal</option>
          </select>
        </label>
        <label>
          Duración
          <select
            value={value.duration}
            onChange={(e) => change({ duration: Number(e.target.value) })}
          >
            {(omni
              ? [3, 4, 5, 6, 7, 8, 9, 10]
              : value.resolution === "1080p"
                ? [8]
                : [4, 6, 8]
            ).map((n) => (
              <option key={n} value={n}>
                {n} segundos
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Resolución
        <select
          value={value.resolution}
          onChange={(e) =>
            change({
              resolution: e.target.value as VideoSettings["resolution"],
            })
          }
        >
          {(omni ? ["360p", "720p", "1080p", "4k"] : ["720p", "1080p"]).map(
            (r) => (
              <option key={r} value={r}>
                {r}
                {r === "360p"
                  ? " · Borrador"
                  : r === "720p"
                    ? " · Estándar"
                    : omni
                      ? " · Reescalado"
                      : ""}
              </option>
            ),
          )}
        </select>
      </label>
    </fieldset>
  );
}
export function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className="button" onClick={onClick}>
      <Plus size={16} />
      {children}
    </button>
  );
}
export function Dismiss({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Cerrar aviso" onClick={onClick}>
      <X size={16} />
    </IconButton>
  );
}
