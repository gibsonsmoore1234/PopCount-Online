import { Suspense } from "react";
import { MapScreen } from "@/components/map/map-screen";
import { listBubbles } from "@/server/bubbles";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  // Always show the map, even if the database is unreachable (see /api/health for the cause).
  const bubbles = await listBubbles().catch((err) => {
    console.error("listBubbles failed:", err);
    return [];
  });
  return (
    <Suspense>
      <MapScreen initialBubbles={bubbles} />
    </Suspense>
  );
}
