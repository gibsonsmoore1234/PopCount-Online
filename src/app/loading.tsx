export default function Loading() {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center" aria-busy="true" aria-label="Loading">
      <div className="border-ink shadow-hard-sm flex items-center gap-2 rounded-xl border-2 bg-white px-4 py-2 text-xs font-extrabold">
        <span className="animate-pulse-ring bg-aura-high h-2.5 w-2.5 rounded-full" /> Loading…
      </div>
    </div>
  );
}
