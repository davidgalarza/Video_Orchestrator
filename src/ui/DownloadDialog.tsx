import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { sceneBlob, type Scene } from "../types";
import { archiveClips, archiveNames } from "../lib/archive";
import { downloadBlob } from "../lib/media";
import { StudioDialog } from "./StudioDialog";
export function DownloadDialog({
  scenes,
  selectedIds,
  projectName,
  onClose,
}: {
  scenes: Scene[];
  selectedIds: string[];
  projectName: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState(
    selectedIds.length
      ? "selected"
      : scenes.some((s) => s.review === "favorite")
        ? "favorites"
        : "all",
  );
  const [naming, setNaming] = useState("titles");
  const [prefix, setPrefix] = useState(projectName);
  const [names, setNames] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = scenes.filter(
    (s) =>
      sceneBlob(s) &&
      (scope === "selected"
        ? selectedIds.includes(s.id)
        : s.review !== "discarded" &&
          (scope === "all" || s.review === "favorite")),
  );
  const options = {
    prefix: naming === "prefix" ? prefix : undefined,
    names,
    includeMetadata: metadata,
  };
  const filenames = archiveNames(ready, options);
  const size = ready.reduce((sum, s) => sum + sceneBlob(s)!.size, 0);
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      downloadBlob(
        await archiveClips(ready, options),
        `${projectName}-clips.zip`,
      );
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo preparar la descarga.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioDialog
      title="Descargar clips"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="hint">
        Vídeos originales, sin recomprimir, listos para tu editor local.
      </p>
      <fieldset disabled={busy} className="download-options">
        <label>
          Qué descargar
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="selected" disabled={!selectedIds.length}>
              Clips seleccionados
            </option>
            <option value="favorites">Favoritos</option>
            <option value="all">Todos los disponibles</option>
          </select>
        </label>
        <label>
          Nombres de archivo
          <select value={naming} onChange={(e) => setNaming(e.target.value)}>
            <option value="titles">Usar nombres de los clips</option>
            <option value="prefix">Nombre común + número</option>
          </select>
        </label>
        {naming === "prefix" && (
          <label>
            Nombre común
            <input
              value={prefix}
              maxLength={80}
              onChange={(e) => setPrefix(e.target.value)}
            />
          </label>
        )}
        <label className="check-row">
          <input
            type="checkbox"
            checked={metadata}
            onChange={(e) => setMetadata(e.target.checked)}
          />
          Incluir prompts y ajustes (clips.json)
        </label>
        <details className="download-names">
          <summary>
            Revisar y personalizar {ready.length}{" "}
            {ready.length === 1 ? "nombre" : "nombres"}
          </summary>
          {ready.map((scene, i) => (
            <label key={scene.id}>
              {scene.title}
              <input
                aria-label={`Nombre de archivo: ${scene.title}`}
                placeholder={filenames[i]}
                value={names[scene.id] ?? ""}
                onChange={(e) =>
                  setNames({ ...names, [scene.id]: e.target.value })
                }
              />
              <small>{filenames[i]}</small>
            </label>
          ))}
        </details>
      </fieldset>
      <p className="hint">
        {ready.length} {ready.length === 1 ? "vídeo" : "vídeos"} ·{" "}
        {(size / 1024 / 1024).toFixed(1)} MB
        {scope !== "selected"
          ? " · Los descartados se excluyen."
          : " · Solo se incluyen clips con vídeo."}
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary full"
        disabled={busy || !ready.length}
        onClick={() => void download()}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Download size={16} />
        )}
        {busy
          ? "Preparando descarga…"
          : `Descargar ${ready.length} ${ready.length === 1 ? "clip" : "clips"} · ZIP`}
      </button>
    </StudioDialog>
  );
}
