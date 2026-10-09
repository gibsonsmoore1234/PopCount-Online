import { Suspense } from "react";
import { MapScreen } from "@/components/map/map-screen";
import { listBubbles } from "@/server/bubbles";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const bubbles = await listBubbles();
  return (
    <Suspense>
      <MapScreen initialBubbles={bubbles} />
    </Suspense>
  );
}
