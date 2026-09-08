import {
  downloadResolutions,
  outputDimensions,
  type DownloadResolution,
} from "../lib/videoQuality";
export function DownloadQuality({
  value,
  onChange,
  source,
  sequence = false,
}: {
  value: DownloadResolution;
  onChange: (value: DownloadResolution) => void;
  source?: { width: number; height: number };
  sequence?: boolean;
}) {
  const target = source
    ? outputDimensions(source.width, source.height, value)
    : undefined;
  return (
    <div className="download-quality">
      <label>
        Resolución de descarga
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as DownloadResolution)}
        >
          {downloadResolutions
            .filter((option) => !sequence || option.value !== "original")
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
      </label>
      {source && target && (
        <p className="download-dimensions">
          {source.width} × {source.height}
          {value !== "original" && (
            <>
              {" "}
              →{" "}
              <strong>
                {target.width} × {target.height}
              </strong>
            </>
          )}
        </p>
      )}
      <p className="hint">
        {value === "original"
          ? "El archivo tal como se generó, sin pérdida adicional de calidad."
          : sequence
            ? "Un MP4 con los clips unidos, ajustados al formato de la secuencia."
            : "Mantiene el encuadre, el audio y la velocidad. El original queda intacto."}
      </p>
      {value !== "original" && (
        <p className="hint">
          Escalado local con Lanczos, sin coste de API. Aumentar la resolución
          no recupera detalle perdido.
          {value === "4k" &&
            " 4K puede tardar varios minutos y necesita más memoria; 1080p es la opción más práctica."}
        </p>
      )}
    </div>
  );
}
export function DownloadProgress({
  progress,
}: {
  progress: { text: string; fraction?: number };
}) {
  return (
    <div className="download-progress" role="status">
      <span>
        {progress.text}
        {progress.fraction !== undefined &&
          ` ${Math.round(progress.fraction * 100)} %`}
      </span>
      <progress
        aria-label="Progreso de preparación"
        max={1}
        value={progress.fraction}
      />
      <small>Mantén esta pestaña abierta hasta que termine.</small>
    </div>
  );
}
