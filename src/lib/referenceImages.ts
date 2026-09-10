import { base64Blob, blobDataUrl, type ReferenceImage } from "./google";

// Keep library assets and queued snapshots intact. Only normalize the copy sent
// to the provider: orientation/color conversion, RGB JPEG and bounded dimensions.
export async function prepareReferenceImages(
  images: ReferenceImage[],
  signal: AbortSignal,
): Promise<ReferenceImage[]> {
  const prepared: ReferenceImage[] = [];
  for (const [index, image] of images.entries()) {
    signal.throwIfAborted();
    const label =
      image.role === "first"
        ? "fotograma inicial"
        : image.role === "last"
          ? "fotograma final"
          : `referencia ${index + 1}`;
    let bitmap: ImageBitmap | undefined;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(image.mimeType))
        throw new Error("Formato de imagen no compatible.");
      bitmap = await createImageBitmap(base64Blob(image.data, image.mimeType));
      signal.throwIfAborted();
      if (!bitmap.width || !bitmap.height) throw new Error("Imagen vacía.");
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round((bitmap.width * scale) / 2) * 2);
      canvas.height = Math.max(2, Math.round((bitmap.height * scale) / 2) * 2);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("No se pudo preparar la imagen.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("No se pudo convertir la imagen.")),
          "image/jpeg",
          0.95,
        ),
      );
      if (blob.type !== "image/jpeg" || blob.size > 4 * 1024 * 1024)
        throw new Error("La imagen no se pudo adaptar al tamaño de envío.");
      signal.throwIfAborted();
      const data = await blobDataUrl(blob);
      prepared.push({
        role: image.role,
        mimeType: "image/jpeg",
        data: data.slice(data.indexOf(",") + 1),
      });
    } catch (error) {
      signal.throwIfAborted();
      throw new Error(
        `No se pudo preparar el ${label}. Vuelve a subir esa imagen en JPG o PNG antes de generar.`,
        { cause: error },
      );
    } finally {
      bitmap?.close();
    }
  }
  return prepared;
}
