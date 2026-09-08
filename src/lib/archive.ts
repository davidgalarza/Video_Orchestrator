import { activeVersion, sceneBlob, sceneSettings, type Scene } from "../types";

const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
async function crc32(blob: Blob) {
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const byte of value) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    }
  } finally {
    reader.releaseLock();
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Stored ZIP entries preserve the original encoded video without recompression.
// Blob parts plus incremental CRC calculation avoid copying all media into RAM.
export async function createZip(
  files: { name: string; blob: Blob }[],
): Promise<Blob> {
  if (!files.length) throw new Error("Selecciona al menos un vídeo.");
  if (files.length > 65535)
    throw new Error("Selecciona menos archivos para este ZIP.");
  const encoder = new TextEncoder();
  const entries = files.map((file) => ({
    ...file,
    encoded: encoder.encode(file.name),
  }));
  const estimated = entries.reduce(
    (sum, f) => sum + f.blob.size + 76 + f.encoded.length * 2,
    22,
  );
  if (estimated >= 0xffffffff || entries.some((f) => f.encoded.length > 65535))
    throw new Error(
      "El ZIP supera 4 GB. Descarga los vídeos en grupos más pequeños.",
    );
  const parts: BlobPart[] = [],
    directory: BlobPart[] = [];
  let offset = 0,
    directorySize = 0;
  for (const file of entries) {
    const crc = await crc32(file.blob);
    const header = new Uint8Array(30 + file.encoded.length),
      h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x800, true);
    h.setUint16(12, 33, true); // 1980-01-01, a valid DOS date.
    h.setUint32(14, crc, true);
    h.setUint32(18, file.blob.size, true);
    h.setUint32(22, file.blob.size, true);
    h.setUint16(26, file.encoded.length, true);
    header.set(file.encoded, 30);
    parts.push(header, file.blob);
    const central = new Uint8Array(46 + file.encoded.length),
      c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, file.blob.size, true);
    c.setUint32(24, file.blob.size, true);
    c.setUint16(28, file.encoded.length, true);
    c.setUint32(42, offset, true);
    central.set(file.encoded, 46);
    directory.push(central);
    directorySize += central.length;
    offset += header.length + file.blob.size;
  }
  const end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: "application/zip" });
}
export function clipFilename(scene: Scene, index?: number) {
  const title =
    (scene.title || "Clip")
      .replace(/[<>:"/\\|?*]/g, "-")
      .split("")
      .map((char) => (char.charCodeAt(0) < 32 ? "-" : char))
      .join("")
      .replace(/^\.+|[. ]+$/g, "")
      .slice(0, 80) || "Clip";
  const version = activeVersion(scene);
  const number = version
    ? (scene.versions?.findIndex((v) => v.id === version.id) ?? 0) + 1
    : 1;
  return `${index === undefined ? "" : `${String(index + 1).padStart(3, "0")}-`}${title}-v${number}.mp4`;
}
export async function archiveClips(scenes: Scene[]) {
  const ready = scenes.filter((scene) => sceneBlob(scene));
  if (!ready.length)
    throw new Error("La selección no contiene vídeos generados.");
  const files = ready.map((scene, i) => ({
    name: clipFilename(scene, i),
    blob: sceneBlob(scene)!,
  }));
  const manifest = ready.map((scene, i) => ({
    file: files[i].name,
    title: scene.title,
    prompt: activeVersion(scene)?.prompt || scene.prompt,
    settings: activeVersion(scene)?.settings || sceneSettings(scene),
    version_id: activeVersion(scene)?.id,
  }));
  return createZip([
    ...files,
    {
      name: "clips.json",
      blob: new Blob([JSON.stringify(manifest, null, 2)], {
        type: "application/json",
      }),
    },
  ]);
}
