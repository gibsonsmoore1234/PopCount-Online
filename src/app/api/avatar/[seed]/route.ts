import { NextResponse } from "next/server";
import { api, type Params } from "@/lib/api/route";
import { notFound } from "@/lib/errors";

/** Neutral photo placeholder (dark gradient + silhouette) for demo profiles without an uploaded photo. */
export const GET = api(async (_req, { params }: Params<{ seed: string }>) => {
  const { seed } = await params;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(seed)) throw notFound("Avatar not found.");
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const tone = 18 + (h % 14);
  const label = seed
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(240 6% ${tone + 8}%)"/><stop offset="1" stop-color="hsl(240 6% ${tone - 10}%)"/></linearGradient>
<radialGradient id="l" cx="0.5" cy="0.25" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="400" height="600" fill="url(#g)"/><rect width="400" height="600" fill="url(#l)"/>
<circle cx="200" cy="230" r="78" fill="#000" fill-opacity="0.35"/>
<path d="M60 600c10-120 70-190 140-190s130 70 140 190z" fill="#000" fill-opacity="0.35"/>
<text x="200" y="250" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="56" fill="#fff" fill-opacity="0.55">${label}</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
