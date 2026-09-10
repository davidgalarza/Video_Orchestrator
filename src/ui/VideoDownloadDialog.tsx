import { useEffect, useRef, useState } from "react";
import type { AspectRatio } from "../types";
import { downloadBlob } from "../lib/media";
import {
  qualityFilename,
  type VideoSegment,
  type DownloadResolution,
} from "../lib/videoQuality";
import { StudioDialog } from "./StudioDialog";
import { DownloadProgress, DownloadQuality } from "./DownloadQuality";
export interface VideoDownload {
  blobs: Blob[];
  segments?: VideoSegment[];
  filename: string;
  title: string;
  aspect?: AspectRatio;
}
export function VideoDownloadDialog({
  video,
  onClose,
}: {
  video: VideoDownload;
  onClose: () => void;
}) {
  const sequence = !!video.aspect;
  const [resolution, setResolution] = useState<DownloadResolution>(
    sequence ? "720p" : "original",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<{ width: number; height: number }>();
  const [progress, setProgress] = useState<{ text: string; fraction?: number }>(
    { text: "Preparando descarga…" },
  );
  const controller = useRef<AbortController | undefined>(undefined);
  const blob = video.blobs[0];
  useEffect(() => {
    const objectURL = URL.createObjectURL(blob);
    if (preview.current) preview.current.src = objectURL;
    return () => {
      URL.revokeObjectURL(objectURL);
      controller.current?.abort();
    };
  }, [blob]);
  async function download() {
    if (busy) return;
    const task = new AbortController();
    controller.current = task;
    setBusy(true);
    setError("");
    setProgress({ text: "Preparando descarga…" });
    try {
      let output = blob;
      if (sequence || resolution !== "original") {
        const { resizeVideo, stitchVideos } = await import("../lib/export");
        const options = {
          signal: task.signal,
          onProgress: setProgress,
          segments: video.segments,
        };
        output = sequence
          ? await stitchVideos(video.blobs, video.aspect!, resolution, options)
          : await resizeVideo(blob, resolution, options);
      }
      task.signal.throwIfAborted();
      downloadBlob(output, qualityFilename(video.filename, resolution));
      onClose();
    } catch (e) {
      if (task.signal.aborted)
        setError(
          "Preparación cancelada. Puedes elegir otra resolución o descargar el original.",
        );
      else
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo preparar el vídeo. Prueba una resolución menor.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <StudioDialog
      title={sequence ? "Exportar secuencia" : "Descargar vídeo"}
      busy={busy}
      onClose={onClose}
    >
      <p className="hint">
        {video.title}
        {sequence && ` · ${video.blobs.length} clips`}
      </p>
      {!sequence && (
        <video
          className="download-preview"
          ref={preview}
          controls
          preload="metadata"
          onLoadedMetadata={(e) =>
            setSource({
              width: e.currentTarget.videoWidth,
              height: e.currentTarget.videoHeight,
            })
          }
        />
      )}
      <fieldset disabled={busy} className="download-options">
        <DownloadQuality
          value={resolution}
          onChange={setResolution}
          sequence={sequence}
          source={sequence ? undefined : source}
        />
      </fieldset>
      {busy && <DownloadProgress progress={progress} />}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="download-actions">
        <button
          className="button"
          onClick={() => (busy ? controller.current?.abort() : onClose())}
        >
          {busy ? "Cancelar preparación" : "Cancelar"}
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void download()}
        >
          {busy ? "Preparando…" : "Descargar MP4"}
        </button>
      </div>
    </StudioDialog>
  );
}
