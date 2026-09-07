import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import type { AspectRatio } from "../types";

let instance: Promise<FFmpeg> | undefined;
let exporting = false;
async function engine() {
  if (!instance)
    instance = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })().catch((error) => {
      instance = undefined;
      throw error;
    });
  return instance;
}
export async function stitchVideos(
  blobs: Blob[],
  aspect: AspectRatio,
): Promise<Blob> {
  if (!blobs.length) throw new Error("No hay clips que exportar.");
  if (blobs.length === 1) return blobs[0];
  if (exporting) throw new Error("Ya hay una exportación en curso.");
  if (!crossOriginIsolated)
    throw new Error(
      "La exportación necesita los encabezados de aislamiento incluidos en vercel.json. Reinicia la vista o descarga cada clip por separado.",
    );
  exporting = true;
  const files: string[] = [];
  let ffmpeg: FFmpeg | undefined;
  try {
    ffmpeg = await engine();
    const [width, height] = aspect === "9:16" ? [720, 1280] : [1280, 720];
    for (const [i, blob] of blobs.entries()) {
      const input = `in-${i}.mp4`,
        output = `clip-${i}.mp4`,
        probe = `probe-${i}.json`;
      files.push(input, output, probe);
      await ffmpeg.writeFile(input, await fetchFile(blob));
      // Core 0.12.10 may leave its shared return-code slot at -1 after a successful
      // ffprobe call. Validate the actual probe artifact instead of that slot.
      await ffmpeg.ffprobe([
        "-v",
        "error",
        "-show_streams",
        "-of",
        "json",
        input,
        "-o",
        probe,
      ]);
      const info = JSON.parse(
        (await ffmpeg.readFile(probe, "utf8")) as string,
      ) as { streams: { codec_type: string }[] };
      if (
        !Array.isArray(info.streams) ||
        !info.streams.some((stream) => stream.codec_type === "video")
      )
        throw new Error(
          "No se pudo leer el vídeo de una escena. Descarga los clips por separado.",
        );
      const hasAudio = info.streams.some(
        (stream) => stream.codec_type === "audio",
      );
      const code = await ffmpeg.exec([
        "-i",
        input,
        ...(!hasAudio
          ? [
              "-f",
              "lavfi",
              "-i",
              "anullsrc=channel_layout=stereo:sample_rate=48000",
            ]
          : []),
        "-map",
        "0:v:0",
        "-map",
        hasAudio ? "0:a:0" : "1:a:0",
        "-vf",
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24`,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-shortest",
        output,
      ]);
      if (code !== 0)
        throw new Error(
          "No se pudo preparar un clip para exportación. Descarga las tomas por separado.",
        );
    }
    files.push("sequence.txt", "final.mp4");
    await ffmpeg.writeFile(
      "sequence.txt",
      blobs.map((_, i) => `file 'clip-${i}.mp4'`).join("\n"),
    );
    const code = await ffmpeg.exec([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "sequence.txt",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "final.mp4",
    ]);
    if (code !== 0)
      throw new Error(
        "No se pudieron unir las escenas. Descarga los clips por separado.",
      );
    const data = (await ffmpeg.readFile("final.mp4")) as Uint8Array;
    return new Blob([new Uint8Array(data)], { type: "video/mp4" });
  } finally {
    if (ffmpeg)
      for (const file of files)
        await ffmpeg.deleteFile(file).catch(() => undefined);
    exporting = false;
  }
}
