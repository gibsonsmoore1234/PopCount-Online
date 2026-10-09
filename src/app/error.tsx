"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4">
      <div role="alert" className="border-ink shadow-hard-lg max-w-sm rounded-2xl border-2 bg-white p-8 text-center">
        <h1 className="text-2xl font-black tracking-tight uppercase">Something broke</h1>
        <p className="text-muted mt-1 text-sm font-semibold">We hit an unexpected error loading this page.</p>
        {error.digest && <p className="text-muted mt-2 font-mono text-[10px]">ref {error.digest}</p>}
        <button
          onClick={reset}
          className="border-ink bg-ink shadow-hard-sm mt-5 inline-flex h-10 items-center gap-2 rounded-xl border-2 px-4 text-sm font-extrabold text-white"
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}
