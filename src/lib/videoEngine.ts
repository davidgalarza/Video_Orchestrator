import { FFmpeg } from "@ffmpeg/ffmpeg";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import type { VideoProcessingOptions } from "./videoQuality";
let instance: FFmpeg | undefined;
let busy = false;
export async function withVideoEngine<T>(
  options: VideoProcessingOptions,
  work: (ffmpeg: FFmpeg) => Promise<T>,
): Promise<T> {
  options.signal?.throwIfAborted();
  if (busy)
    throw new Error(
      "Ya se está preparando otro vídeo. Espera a que termine y vuelve a intentarlo.",
    );
  if (!crossOriginIsolated)
    throw new Error(
      "No se pudo iniciar el motor de vídeo. Recarga la página o descarga el original.",
    );
  busy = true;
  const ffmpeg = (instance ||= new FFmpeg());
  const cancel = () => {
    ffmpeg.terminate();
    if (instance === ffmpeg) instance = undefined;
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  try {
    if (!ffmpeg.loaded) {
      options.onProgress?.({ text: "Cargando el motor de vídeo…" });
      await ffmpeg.load({ coreURL, wasmURL });
    }
    options.signal?.throwIfAborted();
    return await work(ffmpeg);
  } catch (error) {
    cancel(); // Release memory and recreate the worker after cancellation or failure.
    if (options.signal?.aborted)
      throw new DOMException("Preparación cancelada.", "AbortError");
    if (/memory|out of bounds|allocation/i.test(String(error)))
      throw new Error(
        "No hay memoria suficiente para esta resolución. Cierra otras pestañas y prueba 1080p, o descarga el original.",
        { cause: error },
      );
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    busy = false;
  }
}
