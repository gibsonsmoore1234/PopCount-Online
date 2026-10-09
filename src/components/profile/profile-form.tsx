"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ImageUp, Link2, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { AuraFrame } from "@/components/aura/aura";
import { Photo } from "@/components/aura/photo";
import { useBubbles, useCreateProfile, useMe, useUpdateProfile, useUpload } from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { prepareImage } from "@/lib/image";
import { errorMessage } from "@/lib/api/client";
import { createProfileSchema, updateProfileSchema } from "@/lib/validation";
import type { Gender, ProfileDetail } from "@/types/api";
import { cn } from "@/lib/utils";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "NON_BINARY", label: "Non-binary" },
];

type Errors = Partial<Record<"displayName" | "bubbleId" | "photoUrl" | "affiliation" | "bio" | "consent", string>>;

/** Create (opt-in, self only) or edit your own profile. */
export function ProfileFormDialog({
  open,
  onOpenChange,
  profile,
  defaultBubbleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: ProfileDetail;
  defaultBubbleId?: string | null;
}) {
  const isEdit = Boolean(profile);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? "Edit your profile" : "Create your profile"}
        description={isEdit ? "Changes are visible immediately." : "Profiles are opt-in — you can only post yourself."}
        size="lg"
      >
        {/* Dialog content unmounts when closed, so the form state resets on every open. */}
        <ProfileFormBody profile={profile} defaultBubbleId={defaultBubbleId} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProfileFormBody({
  profile,
  defaultBubbleId,
  onDone,
}: {
  profile?: ProfileDetail;
  defaultBubbleId?: string | null;
  onDone: () => void;
}) {
  const isEdit = Boolean(profile);
  const router = useRouter();
  const { data: me } = useMe();
  const { data: bubbles } = useBubbles();
  const create = useCreateProfile();
  const update = useUpdateProfile(profile?.id ?? "");
  const upload = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [chosenBubble, setBubbleId] = useState("");
  const [gender, setGender] = useState<Gender>(profile?.gender ?? "FEMALE");
  const [affiliation, setAffiliation] = useState(profile?.affiliation ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl ?? "");
  const [urlDraft, setUrlDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const bubbleId =
    chosenBubble ||
    (profile ? bubbles?.find((b) => b.slug === profile.bubble.slug)?.id : defaultBubbleId) ||
    bubbles?.[0]?.id ||
    "";

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await prepareImage(file, { aspect: 2 / 3, maxWidth: 900 });
      const res = await upload.mutateAsync(blob);
      setPhotoUrl(res.url);
      setErrors((e) => ({ ...e, photoUrl: undefined }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      bubbleId,
      displayName,
      gender,
      affiliation: affiliation.trim() || undefined,
      bio,
      photoUrl,
    };
    const parsed = isEdit
      ? updateProfileSchema.safeParse({ ...payload, affiliation: affiliation.trim() || null })
      : createProfileSchema.safeParse({ ...payload, consent });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    if (isEdit && profile) {
      update.mutate(
        { ...payload, affiliation: affiliation.trim() || null },
        {
          onSuccess: () => {
            toast.success("Profile updated");
            onDone();
          },
          onError: (err) => toast.error(errorMessage(err)),
        },
      );
    } else {
      create.mutate(
        { ...payload, consent: true },
        {
          onSuccess: ({ profile: created }) => {
            toast.success("You're on the map!", {
              description: "Your profile is live — share it with friends to collect votes.",
            });
            onDone();
            router.push(`/p/${created.id}`);
          },
          onError: (err) => toast.error(errorMessage(err)),
        },
      );
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={submit} className="space-y-5 p-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <div className="mx-auto w-40 sm:w-full">
          <AuraFrame score={null} thickness="sm">
            <div className="border-ink bg-surface-2 relative aspect-[2/3] overflow-hidden rounded-xl border-2">
              {photoUrl ? (
                <Photo src={photoUrl} alt={displayName || "Your photo"} />
              ) : (
                <div className="pc-dotgrid text-muted grid h-full place-items-center p-3 text-center text-[11px] font-extrabold uppercase">
                  2:3 portrait photo
                </div>
              )}
              {upload.isPending && (
                <div className="absolute inset-0 grid place-items-center bg-white/70">
                  <Spinner className="h-6 w-6" />
                </div>
              )}
            </div>
          </AuraFrame>
        </div>

        <div className="space-y-3">
          <Field
            label="Photo *"
            error={errors.photoUrl}
            hint="Upload a photo of yourself — we crop it to 2:3 and strip location data."
          >
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
              >
                <ImageUp className="h-4 w-4" strokeWidth={2.5} /> Upload photo
              </Button>
              {me && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoUrl(`/api/avatar/${me.handle}`)}>
                  <Sparkles className="h-4 w-4" strokeWidth={2.5} /> Use an illustrated avatar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="…or paste an https:// image URL"
                aria-label="Photo URL"
                inputMode="url"
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={!urlDraft.trim()}
                onClick={() => setPhotoUrl(urlDraft.trim())}
                aria-label="Use URL"
              >
                <Link2 className="h-4 w-4" strokeWidth={2.5} />
              </Button>
            </div>
          </Field>

          <Field label="Display name *" htmlFor={`${uid}-name`} error={errors.displayName}>
            <Input
              id={`${uid}-name`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Caroline Vance"
              autoComplete="name"
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campus / town bubble *" htmlFor={`${uid}-bubble`} error={errors.bubbleId}>
          <Select id={`${uid}-bubble`} value={bubbleId} onChange={(e) => setBubbleId(e.target.value)}>
            {(bubbles ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.stateName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Affiliation / Greek / org" htmlFor={`${uid}-aff`} error={errors.affiliation}>
          <Input
            id={`${uid}-aff`}
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            maxLength={40}
            placeholder="e.g. Chi Omega, Club Soccer"
          />
        </Field>
      </div>

      <Field label="Gender tag *">
        <div role="radiogroup" aria-label="Gender" className="grid grid-cols-3 gap-2">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={gender === g.value}
              onClick={() => setGender(g.value)}
              className={cn(
                "border-ink h-10 rounded-xl border-2 text-xs font-extrabold transition",
                gender === g.value ? "bg-ink shadow-hard-sm text-white" : "hover:bg-surface-2 bg-white",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Bio"
        htmlFor={`${uid}-bio`}
        error={errors.bio}
        aside={<span className="text-muted text-[10px] font-bold">{bio.length}/280</span>}
      >
        <Textarea
          id={`${uid}-bio`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Year, major, what you're into…"
        />
      </Field>

      {!isEdit && (
        <div className="space-y-1.5">
          <Checkbox id={`${uid}-consent`} checked={consent} onChange={setConsent}>
            <span className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
              <span>
                <b>This is me.</b> I&apos;m 18+, the photo is of me and I own it, and I want my profile to be publicly
                rated. I can delete it any time.
              </span>
            </span>
          </Checkbox>
          {errors.consent && <p className="text-xs font-bold text-[#9b2c2c]">{errors.consent}</p>}
        </div>
      )}

      <div className="border-line flex justify-end gap-2 border-t-2 pt-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || upload.isPending}>
          {pending && <Spinner />}
          {isEdit ? "Save changes" : "Publish my profile"}
        </Button>
      </div>
    </form>
  );
}

/** Store-driven instance used by the header / map / bubble "Create Profile" buttons. */
export function GlobalProfileForm() {
  const open = useUi((s) => s.profileFormOpen);
  const bubbleId = useUi((s) => s.profileFormBubbleId);
  const close = useUi((s) => s.closeProfileForm);
  const { data: me } = useMe();
  const router = useRouter();

  useEffect(() => {
    // Already have a profile? Take them to it instead of a form that would fail.
    if (open && me?.profile) {
      close();
      router.push(`/p/${me.profile.id}`);
      toast("You already have a profile — edit it from here.");
    }
  }, [open, me, close, router]);

  return (
    <ProfileFormDialog open={open && !me?.profile} onOpenChange={(o) => !o && close()} defaultBubbleId={bubbleId} />
  );
}
