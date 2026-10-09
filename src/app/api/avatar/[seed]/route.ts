import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";
import { NextResponse } from "next/server";
import { api, type Params } from "@/lib/api/route";
import { notFound } from "@/lib/errors";

const BACKGROUNDS = ["a8f093", "fff699", "c8e7ff", "ffd6e7", "e4d4ff", "ffe2b8", "d2f5ec"];

/** Deterministic illustrated avatars (DiceBear "Notionists", CC0) — used for demo profiles. */
export const GET = api(async (_req, { params }: Params<{ seed: string }>) => {
  const { seed } = await params;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(seed)) throw notFound("Avatar not found.");
  const svg = createAvatar(notionists, {
    seed,
    backgroundColor: BACKGROUNDS,
    backgroundType: ["solid"],
    scale: 105,
  }).toString();
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
