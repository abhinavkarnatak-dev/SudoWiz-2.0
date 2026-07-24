import { TARGET_IMAGE_EDGE } from "./scan";

/**
 * Normalise an image to a fixed long edge before uploading it.
 *
 * This scales *up* as well as down, which is not an obvious choice: enlarging a
 * small screenshot adds no detail. It still helps, and measurably so. The same
 * grid at 580px was transcribed 0/3 exact, and the identical image bicubically
 * enlarged to 1400px scored 3/3. What the model needs is enough pixels to
 * resolve cell boundaries, and a browser resize supplies that even though the
 * information content is unchanged. Large phone photos come down to the same
 * edge, which keeps the upload small and the token count predictable.
 *
 * Falls back to the untouched file whenever the browser cannot decode it, which
 * is the common case for iPhone HEIC. The API accepts those formats directly,
 * so the upload is simply larger.
 */
export async function normaliseImage(
  file: File,
  targetEdge: number = TARGET_IMAGE_EDGE,
): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest === 0) return file;

    const scale = targetEdge / longest;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;
    // Smoothing matters when enlarging: nearest-neighbour leaves blocky edges
    // that read worse than the bicubic result the accuracy testing used.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    return blob ?? file;
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
