import type { MetadataRoute } from "next";
import { listBubbles } from "@/server/bubbles";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const bubbles = await listBubbles().catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    ...bubbles.map((b) => ({ url: `${base}/b/${b.slug}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...["/terms", "/guidelines", "/privacy"].map((p) => ({ url: `${base}${p}`, priority: 0.2 })),
  ];
}
