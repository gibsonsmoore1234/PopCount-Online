"use client";

import { useState, useEffect } from "react";
import { Images } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import type { ProfileCard } from "@/types/api";

export function AdminPhotoGallery() {
  const [profiles, setProfiles] = useState<(ProfileCard & { createdAt: string; bubbleName: string })[]>([]);
  const [isPending, setIsPending] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setIsPending(true);
        const res = await fetch("/api/admin/profiles");
        if (!res.ok) throw new Error("Failed to fetch profiles");
        const data = await res.json();
        setProfiles(data.profiles);
        setIsError(false);
      } catch (err) {
        setIsError(true);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsPending(false);
      }
    };
    fetchProfiles();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight uppercase">
          <Images className="h-7 w-7" strokeWidth={2.5} /> Photo gallery
        </h1>
        <p className="text-muted text-xs font-bold">
          All profile photos. Total: {profiles.length}
        </p>
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={error?.message || "Failed to load photos"} onRetry={() => window.location.reload()} />
      ) : profiles.length === 0 ? (
        <EmptyState icon={<Images className="h-5 w-5" />} title="No photos" body="No profile photos have been uploaded yet." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="border-ink group relative overflow-hidden rounded-xl border-2 bg-white shadow-hard-sm transition hover:shadow-lg"
              title={`${profile.displayName} • ${profile.bubbleName}`}
            >
              <img
                src={profile.photoUrl}
                alt={profile.displayName}
                className="aspect-square w-full object-cover transition group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <div className="text-white">
                  <p className="line-clamp-1 text-xs font-black">{profile.displayName}</p>
                  <p className="text-muted line-clamp-1 text-[10px] font-bold">{profile.bubbleName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
