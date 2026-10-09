import { and, asc, count, desc, eq, gt, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { groupMessages, groups, profiles, users } from "@/lib/db/schema";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { cleanUserText, containsBlockedLanguage } from "@/lib/moderation";
import type { SessionUser } from "@/lib/auth/session";
import type { GroupDto, MessageDto } from "@/types/api";
import { slugify } from "./shared";
import { isMember } from "./bubbles";

const MAX_GROUPS_PER_BUBBLE = 50;
const PAGE = 50;
const authorProfile = alias(profiles, "author_profile");

function toGroupDto(g: typeof groups.$inferSelect): GroupDto {
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    messageCount: g.messageCount,
    lastMessageAt: g.lastMessageAt?.toISOString() ?? null,
  };
}

export async function listGroups(bubbleId: string): Promise<GroupDto[]> {
  const rows = await db
    .select()
    .from(groups)
    .where(eq(groups.bubbleId, bubbleId))
    .orderBy(sql`${groups.slug} = 'general' desc`, sql`${groups.lastMessageAt} desc nulls last`, asc(groups.name));
  return rows.map(toGroupDto);
}

export async function createGroup(user: SessionUser, bubbleId: string, input: { name: string; description: string }) {
  if (!(await isMember(user.id, bubbleId))) throw forbidden("Join this bubble to create a group.");
  if (containsBlockedLanguage(input.name)) throw badRequest("Pick a group name without profanity.");
  const slug = slugify(input.name).slice(0, 32);
  const [{ value }] = await db.select({ value: count() }).from(groups).where(eq(groups.bubbleId, bubbleId));
  if (Number(value) >= MAX_GROUPS_PER_BUBBLE) throw conflict("This bubble already has the maximum number of groups.");
  const [existing] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.bubbleId, bubbleId), eq(groups.slug, slug)))
    .limit(1);
  if (existing) throw conflict("A group with that name already exists here.");
  const [g] = await db
    .insert(groups)
    .values({ bubbleId, slug, name: slug, description: cleanUserText(input.description), createdById: user.id })
    .returning();
  return toGroupDto(g);
}

async function loadGroup(groupId: string) {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!g) throw notFound("Group not found.");
  return g;
}

/**
 * Latest messages (ascending) by default; `after` returns only newer messages (live polling),
 * `before` pages back through history.
 */
export async function listMessages(
  groupId: string,
  viewer: SessionUser | null,
  opts: { after?: string; before?: string },
): Promise<{ items: MessageDto[]; hasMore: boolean }> {
  await loadGroup(groupId);
  const after = opts.after ? new Date(opts.after) : null;
  const before = opts.before ? new Date(opts.before) : null;
  const rows = await db
    .select({
      id: groupMessages.id,
      body: groupMessages.body,
      createdAt: groupMessages.createdAt,
      authorId: groupMessages.authorId,
      handle: users.handle,
      authorProfileId: authorProfile.id,
      authorPhoto: authorProfile.photoUrl,
    })
    .from(groupMessages)
    .innerJoin(users, eq(users.id, groupMessages.authorId))
    .leftJoin(authorProfile, eq(authorProfile.userId, groupMessages.authorId))
    .where(
      and(
        eq(groupMessages.groupId, groupId),
        eq(groupMessages.isHidden, false),
        sql`${users.bannedAt} is null`,
        after && !Number.isNaN(after.getTime()) ? gt(groupMessages.createdAt, after) : undefined,
        before && !Number.isNaN(before.getTime()) ? lt(groupMessages.createdAt, before) : undefined,
      ),
    )
    .orderBy(after ? asc(groupMessages.createdAt) : desc(groupMessages.createdAt))
    .limit(PAGE + 1);

  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  if (!after) page.reverse();
  return {
    hasMore,
    items: page.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      author: { handle: r.handle, profileId: r.authorProfileId, photoUrl: r.authorPhoto },
      isMine: viewer?.id === r.authorId,
    })),
  };
}

export async function postMessage(user: SessionUser, groupId: string, body: string): Promise<MessageDto> {
  const g = await loadGroup(groupId);
  if (!(await isMember(user.id, g.bubbleId))) throw forbidden("Join this bubble to post in its groups.");
  return db.transaction(async (tx) => {
    const [m] = await tx
      .insert(groupMessages)
      .values({ groupId, authorId: user.id, body: cleanUserText(body) })
      .returning();
    await tx
      .update(groups)
      .set({ messageCount: sql`${groups.messageCount} + 1`, lastMessageAt: m.createdAt })
      .where(eq(groups.id, groupId));
    const [author] = await tx
      .select({ id: profiles.id, photoUrl: profiles.photoUrl })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return {
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      author: { handle: user.handle, profileId: author?.id ?? null, photoUrl: author?.photoUrl ?? null },
      isMine: true,
    };
  });
}

export async function deleteMessage(user: SessionUser, messageId: string) {
  const [m] = await db.select().from(groupMessages).where(eq(groupMessages.id, messageId)).limit(1);
  if (!m) throw notFound("Message not found.");
  if (m.authorId !== user.id && user.role !== "ADMIN") throw forbidden("You can't delete this message.");
  await db.transaction(async (tx) => {
    await tx.delete(groupMessages).where(eq(groupMessages.id, messageId));
    await tx
      .update(groups)
      .set({ messageCount: sql`greatest(${groups.messageCount} - 1, 0)` })
      .where(eq(groups.id, m.groupId));
  });
  return { deleted: true };
}
