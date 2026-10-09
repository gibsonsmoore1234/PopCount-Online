import Link from "next/link";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <div className="pc-dotgrid grid min-h-[calc(100dvh-4rem)] place-items-center px-4">
      <div className="border-ink shadow-hard-lg max-w-sm rounded-2xl border-2 bg-white p-8 text-center">
        <div className="border-ink bg-aura-mid shadow-hard-sm mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border-2">
          <MapPinOff className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Off the map</h1>
        <p className="text-muted mt-1 text-sm font-semibold">
          That page, profile or bubble doesn&apos;t exist — or it was removed.
        </p>
        <Link
          href="/"
          className="border-ink bg-ink shadow-hard-sm mt-5 inline-flex h-10 items-center rounded-xl border-2 px-4 text-sm font-extrabold text-white"
        >
          Back to the map
        </Link>
      </div>
    </div>
  );
}
