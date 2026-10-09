import { NextResponse } from "next/server";
import { api, uuidParam, type Params } from "@/lib/api/route";
import { notFound } from "@/lib/errors";
import { loadImage } from "@/server/images";

/** Serves uploaded photos, logos and ad media. Supports byte ranges so videos can stream/seek (Safari requires it). */
export const GET = api(async (req, { params }: Params<{ id: string }>) => {
  const id = uuidParam((await params).id, "Image");
  const img = await loadImage(id);
  if (!img) throw notFound("Image not found.");
  const size = img.bytes.length;
  const headers: Record<string, string> = {
    "Content-Type": img.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new NextResponse(new Uint8Array(img.bytes.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new NextResponse(new Uint8Array(img.bytes), { headers: { ...headers, "Content-Length": String(size) } });
});
