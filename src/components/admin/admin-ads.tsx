"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Spinner } from "@/components/ui/misc";

type AdRow = {
  id: string;
  title: string;
  advertiser: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  clickUrl: string | null;
  durationSeconds: number;
  rewardClicks: number;
  isActive: boolean;
  impressions: number;
  completions: number;
};

/** Admin ad inventory: upload image/video creatives that play in "Get more clicks". */
export function AdminAds() {
  const qc = useQueryClient();
  const ads = useQuery({
    queryKey: ["admin-ads"],
    queryFn: async () => (await apiFetch<{ items: AdRow[] }>("/api/admin/ads")).items,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-ads"] });
  const toggle = useMutation({
    mutationFn: (a: AdRow) => apiFetch(`/api/admin/ads/${a.id}`, { method: "PATCH", json: { isActive: !a.isActive } }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/ads/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [clickUrl, setClickUrl] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose an image or video file.");
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("purpose", "ad");
      const up = await apiFetch<{ url: string; contentType: string }>("/api/uploads", { method: "POST", form });
      return apiFetch("/api/admin/ads", {
        method: "POST",
        json: {
          title,
          advertiser,
          clickUrl,
          mediaUrl: up.url,
          mediaType: up.contentType.startsWith("video/") ? "video" : "image",
          durationSeconds: 10,
          rewardClicks: 10,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ad added");
      setFile(null);
      setTitle("");
      setAdvertiser("");
      setClickUrl("");
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight uppercase">
        <Megaphone className="h-6 w-6" strokeWidth={2.5} /> Ads
      </h2>
      <p className="text-muted text-xs font-bold">
        Ads play for 10 seconds in “Get more clicks” and reward the viewer with 10 boost clicks.
      </p>

      <form
        className="border-ink grid gap-3 rounded-2xl border-2 bg-white p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Media (JPEG, PNG, WebP, MP4, WebM · up to 25 MB) *" className="sm:col-span-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm font-semibold"
          />
        </Field>
        <Field label="Title *">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Late-night tacos 2-for-1"
          />
        </Field>
        <Field label="Advertiser">
          <Input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Click-through link (https://)" className="sm:col-span-2">
          <Input value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Button type="submit" className="sm:col-span-2" disabled={create.isPending || !file || title.trim().length < 2}>
          {create.isPending ? <Spinner /> : <Upload className="h-4 w-4" />} Upload ad
        </Button>
      </form>

      {ads.isPending ? (
        <Spinner />
      ) : !ads.data?.length ? (
        <EmptyState
          icon={<Megaphone className="h-5 w-5" />}
          title="No ads yet"
          body="Upload one above — viewers will see “No ads available” until then."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ads.data.map((a) => (
            <li key={a.id} className="border-ink space-y-2 rounded-2xl border-2 bg-white p-3">
              <div className="border-ink aspect-video overflow-hidden rounded-xl border-2 bg-black">
                {a.mediaType === "video" ? (
                  <video src={a.mediaUrl} muted playsInline controls className="h-full w-full object-contain" />
                ) : (
                  <img src={a.mediaUrl} alt={a.title} className="h-full w-full object-contain" />
                )}
              </div>
              <p className="text-sm font-black">{a.title}</p>
              <p className="text-muted text-[11px] font-bold">
                {a.advertiser || "—"} · {a.impressions} views · {a.completions} completed
              </p>
              <div className="flex gap-2">
                <Button size="xs" variant={a.isActive ? "aura" : "secondary"} onClick={() => toggle.mutate(a)}>
                  {a.isActive ? "Live" : "Paused"}
                </Button>
                <Button size="xs" variant="danger" onClick={() => confirm("Delete this ad?") && remove.mutate(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
