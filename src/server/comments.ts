import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { commentReactions, comments, profiles, users } from "@/lib/db/schema";
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
      likes: comments.likeCount,
      dislikes: comments.dislikeCount,
      myReaction: viewer
        ? sql<
            number | null
          >`(select ${commentReactions.value} from ${commentReactions} where ${commentReactions.commentId} = ${comments.id} and ${commentReactions.userId} = ${viewer.id})`
        : sql<number | null>`null`,
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

  const items = rows.slice(0, PAGE).map((r) => toDto(r, viewer));
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
  likes?: number;
  dislikes?: number;
  myReaction?: number | null;
};

function toDto(r: Row, viewer: SessionUser | null): CommentDto {
  const isMine = viewer?.id === r.authorId;
  return {
    id: r.id,
    kind: r.kind,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    // Comments are fully anonymous: only admins see who wrote one.
    author:
      viewer?.role === "ADMIN"
        ? { handle: r.handle, profileId: r.authorProfileId, photoUrl: r.authorPhoto }
        : { handle: "", profileId: null, photoUrl: null },
    likes: r.likes ?? 0,
    dislikes: r.dislikes ?? 0,
    myReaction: r.myReaction === 1 ? 1 : r.myReaction === -1 ? -1 : 0,
    isMine,
    canDelete: isMine || viewer?.role === "ADMIN",
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

/** Like (1), dislike (−1) or clear (0) a comment. Choosing the same reaction again clears it on the client side. */
export async function reactToComment(user: SessionUser, commentId: string, value: -1 | 0 | 1) {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.isHidden, false)))
      .for("update")
      .limit(1);
    if (!c) throw notFound("Comment not found.");
    if (value === 0) {
      await tx
        .delete(commentReactions)
        .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, user.id)));
    } else {
      await tx
        .insert(commentReactions)
        .values({ commentId, userId: user.id, value })
        .onConflictDoUpdate({ target: [commentReactions.commentId, commentReactions.userId], set: { value } });
    }
    const [counts] = await tx
      .update(comments)
      .set({
        likeCount: sql`(select count(*) from ${commentReactions} where ${commentReactions.commentId} = ${commentId} and ${commentReactions.value} = 1)`,
        dislikeCount: sql`(select count(*) from ${commentReactions} where ${commentReactions.commentId} = ${commentId} and ${commentReactions.value} = -1)`,
      })
      .where(eq(comments.id, commentId))
      .returning({ likes: comments.likeCount, dislikes: comments.dislikeCount });
    return { ...counts, myReaction: value };
  });
}
