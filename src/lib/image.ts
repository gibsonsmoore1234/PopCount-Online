/**
 * Client-side image preparation: centre-crop to the target aspect ratio, downscale and re-encode
 * as JPEG. Keeps uploads small (≈100–300 KB) and strips EXIF metadata such as GPS location.
 */
export async function prepareImage(
  file: File,
  opts: {
    aspect: number;
    maxWidth: number;
    quality?: number;
    /** Square crop chosen by the user, in source-image pixels. Overrides the centre crop. */
    crop?: { x: number; y: number; size: number };
  },
): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 20 * 1024 * 1024) throw new Error("That image is over 20 MB.");
  const bitmap = await createImageBitmap(file);
  const { width: W, height: H } = bitmap;
  let sx = 0;
  let sy = 0;
  let sw = W;
  let sh = H;
  if (opts.crop) {
    sx = Math.max(0, opts.crop.x);
    sy = Math.max(0, opts.crop.y);
    sw = sh = Math.min(opts.crop.size, W - sx, H - sy);
  } else if (W / H > opts.aspect) {
    sw = H * opts.aspect;
    sx = (W - sw) / 2;
  } else {
    sh = W / opts.aspect;
    sy = (H - sh) / 2;
  }
  const outW = Math.min(opts.maxWidth, Math.round(sw));
  const outH = Math.round(outW / opts.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      opts.quality ?? 0.86,
    ),
  );
}
