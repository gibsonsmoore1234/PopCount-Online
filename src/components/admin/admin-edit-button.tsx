"use client";

import { useRef, useState } from "react";
import { Pencil, ImageUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { BubbleLogo } from "@/components/aura/bubble-logo";
import { ProfileFormDialog } from "@/components/profile/profile-form";
import { useMe, useUpdateBubble, useUpload } from "@/hooks/api";
import { prepareImage } from "@/lib/image";
import { errorMessage } from "@/lib/api/client";
import type { BubbleSummary, ProfileDetail } from "@/types/api";

/** Admin-only "Edit" for a bubble (name + logo) or a profile (name + photos). Hidden for everyone else. */
export function AdminEditButton(
  props: { kind: "bubble"; bubble: BubbleSummary } | { kind: "profile"; profile: ProfileDetail },
) {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  if (me?.role !== "ADMIN") return null;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" strokeWidth={2.5} /> Admin: edit
      </Button>
      {props.kind === "profile" ? (
        <ProfileFormDialog open={open} onOpenChange={setOpen} profile={props.profile} />
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent title="Edit bubble" description="Rename it or change its logo." size="sm">
            {open && <EditBubble bubble={props.bubble} onDone={() => setOpen(false)} />}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function EditBubble({ bubble, onDone }: { bubble: BubbleSummary; onDone: () => void }) {
  const update = useUpdateBubble(bubble.slug);
  const upload = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(bubble.name);
  const [logoUrl, setLogoUrl] = useState<string | null>(bubble.logoUrl ?? null);

  const onLogo = async (file?: File) => {
    if (!file) return;
    try {
      const blob = await prepareImage(file, { aspect: 1, maxWidth: 256 });
      setLogoUrl((await upload.mutateAsync(blob)).url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = () =>
    update.mutate(
      { name: name.trim(), logoUrl },
      {
        onSuccess: () => {
          toast.success("Bubble updated");
          onDone();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-end gap-3">
        <BubbleLogo
          name={name || bubble.name}
          logoUrl={logoUrl}
          avgAura={bubble.avgAura}
          colors={bubble.colors}
          size={56}
        />
        <Field label="Name" className="flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} />
        </Field>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onLogo(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? <Spinner /> : <ImageUp className="h-4 w-4" />} Change logo
        </Button>
        {logoUrl && (
          <Button type="button" variant="ghost" onClick={() => setLogoUrl(null)}>
            Remove logo
          </Button>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={update.isPending || name.trim().length < 2}>
          {update.isPending && <Spinner />} Save
        </Button>
      </div>
    </div>
  );
}
