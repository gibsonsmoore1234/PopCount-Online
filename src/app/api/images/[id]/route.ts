import { NextResponse } from "next/server";
import { api, uuidParam, type Params } from "@/lib/api/route";
import { notFound } from "@/lib/errors";
import { loadImage } from "@/server/images";

export const GET = api(async (_req, { params }: Params<{ id: string }>) => {
  const id = uuidParam((await params).id, "Image");
  const img = await loadImage(id);
  if (!img) throw notFound("Image not found.");
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: {
      "Content-Type": img.contentType,
      "Content-Length": String(img.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
