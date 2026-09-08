import { blobDataUrl } from "./google";
import { putAsset } from "./storage";
import type { Asset } from "../types";
export async function storeImage(
  file: Blob,
  name: string,
  type: Asset["type"] = "STYLE",
): Promise<Asset> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Sube una imagen JPG, PNG o WebP.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error(
      "La imagen supera 5 MB. Reduce su tamaño y vuelve a subirla.",
    );
  if (typeof createImageBitmap === "function") {
    try {
      const image = await createImageBitmap(file);
      image.close();
    } catch {
      throw new Error(
        "No se puede abrir esta imagen. Prueba con otro archivo JPG, PNG o WebP.",
      );
    }
  }
  const asset: Asset = {
    id: crypto.randomUUID(),
    type,
    data_url: await blobDataUrl(file),
    file_name: name,
    is_global: true,
    project_ids: [],
    created_at: new Date().toISOString(),
  };
  await putAsset(asset);
  return asset;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[<>:"/\\|?*]/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
