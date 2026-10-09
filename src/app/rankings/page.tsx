import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { RankingsPanel } from "@/components/rankings/rankings";

export const metadata: Metadata = { title: "National Rankings" };

export default function RankingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight uppercase">
            <Trophy className="h-7 w-7" strokeWidth={2.5} /> National Rankings
          </h1>
          <p className="text-muted text-xs font-bold">Live leaderboards across every bubble on the map.</p>
        </div>
        <Link
          href="/"
          className="border-ink shadow-hard-sm flex items-center gap-1 rounded-xl border-2 bg-white px-3 py-1.5 text-xs font-extrabold"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={3} /> Map
        </Link>
      </div>
      <div className="border-ink shadow-hard rounded-2xl border-2 bg-white">
        <RankingsPanel />
      </div>
    </div>
  );
}
