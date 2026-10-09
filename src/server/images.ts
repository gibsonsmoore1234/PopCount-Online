import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { badRequest, forbidden } from "@/lib/errors";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Ad media (admins only) may be short videos. */
export const MAX_AD_MEDIA_BYTES = 25 * 1024 * 1024;
const MAX_IMAGES_PER_USER = 40;
const LOCAL_IMAGE_RE = /^\/api\/images\/([0-9a-f-]{36})$/i;

/** Identify the format from magic bytes — never trust the client-supplied MIME type. */
export function sniffVideoType(buf: Buffer): "video/mp4" | "video/webm" | null {
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (buf.length >= 4 && buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  return null;
}

export function sniffImageType(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

export async function saveImage(ownerId: string, file: File, opts: { allowVideo?: boolean } = {}) {
  const max = opts.allowVideo ? MAX_AD_MEDIA_BYTES : MAX_IMAGE_BYTES;
  if (file.size === 0) throw badRequest("That file is empty.");
  if (file.size > max) throw badRequest(`Files must be ${max / 1024 / 1024} MB or smaller.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = sniffImageType(bytes) ?? (opts.allowVideo ? sniffVideoType(bytes) : null);
  if (!contentType)
    throw badRequest(
      opts.allowVideo ? "Upload a JPEG, PNG, WebP, MP4 or WebM file." : "Upload a JPEG, PNG or WebP image.",
    );

  const [{ value: owned }] = await db.select({ value: count() }).from(images).where(eq(images.ownerId, ownerId));
  if (!opts.allowVideo && Number(owned) >= MAX_IMAGES_PER_USER)
    throw badRequest("Upload limit reached — reuse an existing photo.");

  const [row] = await db
    .insert(images)
    .values({ ownerId, contentType, bytes, byteSize: bytes.length })
    .returning({ id: images.id });
  return { id: row.id, url: `/api/images/${row.id}`, contentType };
}

export async function loadImage(id: string) {
  const [row] = await db
    .select({ contentType: images.contentType, bytes: images.bytes })
    .from(images)
    .where(eq(images.id, id))
    .limit(1);
  return row ?? null;
}

/** Uploaded images may only be attached by the account that uploaded them. External https URLs pass through. */
export async function assertOwnImage(userId: string, url: string) {
  const m = LOCAL_IMAGE_RE.exec(url);
  if (!m) return;
  const [row] = await db
    .select({ id: images.id })
    .from(images)
    .where(and(eq(images.id, m[1]), eq(images.ownerId, userId)))
    .limit(1);
  if (!row) throw forbidden("You can only use photos you uploaded yourself.");
}
