"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ImageUp } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { BubbleLogo } from "@/components/aura/bubble-logo";
import { useCreateBubble, useUpload } from "@/hooks/api";
import { createBubbleSchema } from "@/lib/validation";
import { prepareImage } from "@/lib/image";
import { errorMessage } from "@/lib/api/client";

export function CreateBubbleDialog({
  pin,
  onClose,
}: {
  pin: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(pin)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Drop a new bubble" description="Pin any place so its people can find each other." size="md">
        {pin && <CreateBubbleForm pin={pin} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateBubbleForm({ pin, onClose }: { pin: { lat: number; lng: number }; onClose: () => void }) {
  const router = useRouter();
  const create = useCreateBubble();
  const upload = useUpload();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const kind = "TOWN" as const;
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onLogo = async (file?: File) => {
    if (!file) return;
    try {
      const blob = await prepareImage(file, { aspect: 1, maxWidth: 256 });
      const res = await upload.mutateAsync(blob);
      setLogoUrl(res.url);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createBubbleSchema.safeParse({
      name,
      description,
      kind,
      logoUrl,
      lat: pin.lat,
      lng: pin.lng,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form.");
    setError(null);
    create.mutate(
      { name, description, kind, logoUrl: logoUrl || undefined, lat: pin.lat, lng: pin.lng },
      {
        onSuccess: ({ bubble }) => {
          toast.success(`${bubble.name} is on the map!`, { description: `${bubble.countyName}, ${bubble.stateName}` });
          onClose();
          router.push(`/b/${bubble.slug}`);
        },
        onError: (err) => {
          setError(errorMessage(err));
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5" noValidate>
      <div className="border-ink bg-surface flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-bold">
        <MapPin className="h-4 w-4" strokeWidth={2.5} />
        Pinned at {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
      </div>

      <div className="flex items-end gap-3">
        <BubbleLogo name={name || "New"} logoUrl={logoUrl || null} avgAura={null} size={56} />
        <Field label="Bubble name *" htmlFor={`${uid}-n`} className="flex-1">
          <Input
            id={`${uid}-n`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={48}
            placeholder="e.g. Ole Miss"
          />
        </Field>
      </div>

      <Field label="Description" htmlFor={`${uid}-d`} hint="Who's in this bubble?">
        <Textarea
          id={`${uid}-d`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="e.g. Undergrad student body"
        />
      </Field>

      <div>
        <Field label="Logo">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onLogo(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? <Spinner /> : <ImageUp className="h-4 w-4" strokeWidth={2.5} />}{" "}
            {logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
        </Field>
      </div>

      {error && (
        <p role="alert" className="border-ink bg-aura-low/20 rounded-xl border-2 px-3 py-2 text-xs font-bold">
          {error}
        </p>
      )}

      <div className="border-line flex justify-end gap-2 border-t-2 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <Spinner />} Create bubble
        </Button>
      </div>
    </form>
  );
}
