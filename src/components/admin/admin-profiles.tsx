"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Users, ExternalLink } from "lucide-react";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { timeAgo } from "@/lib/utils";
import type { ProfileCard } from "@/types/api";

export function AdminProfiles() {
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
    <div className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight uppercase">
          <Users className="h-7 w-7" strokeWidth={2.5} /> All profiles
        </h1>
        <p className="text-muted text-xs font-bold">
          Showing all profiles sorted by newest first. Total: {profiles.length}
        </p>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={error?.message || "Failed to load profiles"} onRetry={() => window.location.reload()} />
      ) : profiles.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No profiles" body="No profiles have been created yet." />
      ) : (
        <ul className="space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id} className="border-ink shadow-hard-sm rounded-2xl border-2 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <img
                    src={profile.photoUrl}
                    alt={profile.displayName}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black">{profile.displayName}</p>
                      {profile.bubbleName && (
                        <span className="text-muted text-xs font-bold">@ {profile.bubbleName}</span>
                      )}
                    </div>
                    <p className="text-muted text-xs font-bold">{profile.gender}</p>
                    <div className="mt-2 flex gap-4 text-xs font-bold">
                      <span>
                        <span className="text-muted">Rating:</span> {profile.voteCount > 0 ? profile.auraScore?.toFixed(1) : "—"}
                      </span>
                      <span>
                        <span className="text-muted">Votes:</span> {profile.voteCount}
                      </span>
                      <span>
                        <span className="text-muted">Comments:</span> {profile.commentCount}
                      </span>
                    </div>
                    <p className="text-muted mt-1 text-xs">Created {timeAgo(profile.createdAt)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/p/${profile.id}`}
                    target="_blank"
                    className="flex items-center gap-1 rounded-lg border-2 border-ink bg-white px-3 py-2 text-xs font-bold hover:bg-surface"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                  <AdminDeleteButton
                    kind="profile"
                    id={profile.id}
                    name={profile.displayName}
                    backTo="/admin"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
