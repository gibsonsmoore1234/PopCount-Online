"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDeleteBubble, useDeleteProfile, useMe } from "@/hooks/api";
import { errorMessage } from "@/lib/api/client";

/** Admin-only delete for a profile or a whole bubble. Renders nothing for everyone else. */
export function AdminDeleteButton(
  props: { kind: "profile"; id: string; name: string; backTo: string } | { kind: "bubble"; slug: string; name: string },
) {
  const { data: me } = useMe();
  if (me?.role !== "ADMIN") return null;
  return props.kind === "profile" ? (
    <DeleteProfile id={props.id} name={props.name} backTo={props.backTo} />
  ) : (
    <DeleteBubble slug={props.slug} name={props.name} />
  );
}

function DeleteProfile({ id, name, backTo }: { id: string; name: string; backTo: string }) {
  const router = useRouter();
  const del = useDeleteProfile(id);
  return (
    <AdminButton
      pending={del.isPending}
      onClick={() => {
        if (!confirm(`Delete ${name}'s profile? This can't be undone.`)) return;
        del.mutate(undefined, {
          onSuccess: () => {
            toast.success("Profile deleted");
            router.push(backTo);
          },
          onError: (e) => toast.error(errorMessage(e)),
        });
      }}
    />
  );
}

function DeleteBubble({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const del = useDeleteBubble(slug);
  return (
    <AdminButton
      pending={del.isPending}
      onClick={() => {
        if (!confirm(`Delete the ${name} bubble and every profile in it? This can't be undone.`)) return;
        del.mutate(undefined, {
          onSuccess: () => {
            toast.success("Bubble deleted");
            router.push("/");
          },
          onError: (e) => toast.error(errorMessage(e)),
        });
      }}
    />
  );
}

function AdminButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <Button size="sm" variant="danger" disabled={pending} onClick={onClick}>
      <Trash2 className="h-4 w-4" strokeWidth={2.5} /> Admin: delete
    </Button>
  );
}
