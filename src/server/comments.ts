import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { comments, profiles, users } from "@/lib/db/schema";
import { forbidden, notFound } from "@/lib/errors";
import { cleanUserText } from "@/lib/moderation";
import type { SessionUser } from "@/lib/auth/session";
import type { CommentDto, CommentKind, Page } from "@/types/api";
import { alias } from "drizzle-orm/pg-core";

const PAGE = 20;
const authorProfile = alias(profiles, "author_profile");

export async function listComments(
  profileId: string,
  kind: CommentKind,
  viewer: SessionUser | null,
  before?: string,
): Promise<Page<CommentDto>> {
  const [owner] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!owner) throw notFound("Profile not found.");

  const beforeDate = before ? new Date(before) : null;
  const rows = await db
    .select({
      id: comments.id,
      kind: comments.kind,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: comments.authorId,
      handle: users.handle,
      authorProfileId: authorProfile.id,
      authorPhoto: authorProfile.photoUrl,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .leftJoin(authorProfile, eq(authorProfile.userId, comments.authorId))
    .where(
      and(
        eq(comments.profileId, profileId),
        eq(comments.kind, kind),
        eq(comments.isHidden, false),
        sql`${users.bannedAt} is null`,
        beforeDate && !Number.isNaN(beforeDate.getTime()) ? lt(comments.createdAt, beforeDate) : undefined,
      ),
    )
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(PAGE + 1);

  const items = rows.slice(0, PAGE).map((r) => toDto(r, viewer, owner.userId));
  return { items, nextCursor: rows.length > PAGE ? items[items.length - 1].createdAt : null };
}

type Row = {
  id: string;
  kind: CommentKind;
  body: string;
  createdAt: Date;
  authorId: string;
  handle: string;
  authorProfileId: string | null;
  authorPhoto: string | null;
};

function toDto(r: Row, viewer: SessionUser | null, ownerId: string): CommentDto {
  const isMine = viewer?.id === r.authorId;
  return {
    id: r.id,
    kind: r.kind,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: { handle: r.handle, profileId: r.authorProfileId, photoUrl: r.authorPhoto },
    isMine,
    // Authors, the profile owner (moderating their own page) and admins can remove a comment.
    canDelete: isMine || viewer?.id === ownerId || viewer?.role === "ADMIN",
  };
}

export async function addComment(user: SessionUser, profileId: string, kind: CommentKind, body: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: profiles.id, userId: profiles.userId, isHidden: profiles.isHidden })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .for("update")
      .limit(1);
    if (!p || p.isHidden) throw notFound("Profile not found.");

    const [row] = await tx
      .insert(comments)
      .values({ profileId, authorId: user.id, kind, body: cleanUserText(body) })
      .returning();
    await tx
      .update(profiles)
      .set(
        kind === "ADVICE"
          ? { adviceCount: sql`${profiles.adviceCount} + 1` }
          : { commentCount: sql`${profiles.commentCount} + 1` },
      )
      .where(eq(profiles.id, profileId));

    const [author] = await tx
      .select({ id: profiles.id, photoUrl: profiles.photoUrl })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return toDto(
      {
        ...row,
        handle: user.handle,
        authorProfileId: author?.id ?? null,
        authorPhoto: author?.photoUrl ?? null,
      },
      user,
      p.userId,
    );
  });
}

export async function deleteComment(user: SessionUser, commentId: string) {
  await db.transaction(async (tx) => {
    const [c] = await tx
      .select({
        id: comments.id,
        kind: comments.kind,
        authorId: comments.authorId,
        profileId: comments.profileId,
        isHidden: comments.isHidden,
        ownerId: profiles.userId,
      })
      .from(comments)
      .innerJoin(profiles, eq(profiles.id, comments.profileId))
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!c) throw notFound("Comment not found.");
    if (c.authorId !== user.id && c.ownerId !== user.id && user.role !== "ADMIN") {
      throw forbidden("You can't delete this comment.");
    }
    await removeComment(tx, c);
  });
  return { deleted: true };
}

/** Delete a comment and keep the profile's denormalised counters in sync. */
export async function removeComment(
  tx: Tx,
  c: { id: string; kind: CommentKind; profileId: string; isHidden: boolean },
) {
  await tx.delete(comments).where(eq(comments.id, c.id));
  if (!c.isHidden) await adjustCount(tx, c.profileId, c.kind, -1);
}

export async function adjustCount(tx: Tx, profileId: string, kind: CommentKind, delta: 1 | -1) {
  await tx
    .update(profiles)
    .set(
      kind === "ADVICE"
        ? { adviceCount: sql`greatest(${profiles.adviceCount} + ${delta}, 0)` }
        : { commentCount: sql`greatest(${profiles.commentCount} + ${delta}, 0)` },
    )
    .where(eq(profiles.id, profileId));
}
