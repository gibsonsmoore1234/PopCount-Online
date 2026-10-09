import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { bubbles, comments, groupMessages, groups, profiles, reports, users } from "@/lib/db/schema";
import type { ReportTarget } from "@/lib/db/schema";
import { badRequest, conflict, isUniqueViolation, notFound } from "@/lib/errors";
import { AUTO_HIDE_REPORT_THRESHOLD } from "@/lib/moderation";
import { destroyAllSessions, type SessionUser } from "@/lib/auth/session";
import type { ReportDto } from "@/types/api";
import { adjustCount, removeComment } from "./comments";

export async function createReport(
  user: SessionUser,
  input: { targetType: ReportTarget; targetId: string; reason: string; details: string },
) {
  const target = await describeTarget(input.targetType, input.targetId);
  if (!target) throw notFound("That content no longer exists.");
  if (target.ownerId === user.id) throw badRequest("You can't report your own content — delete it instead.");

  try {
    await db.transaction(async (tx) => {
      await tx.insert(reports).values({ reporterId: user.id, ...input });
      if (input.targetType === "COMMENT" || input.targetType === "MESSAGE") {
        await bumpAndMaybeHide(tx, input.targetType, input.targetId);
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("You've already reported this — our moderators are on it.");
    throw err;
  }
  return { reported: true };
}

/** Comments/messages are hidden automatically once enough distinct people report them. */
async function bumpAndMaybeHide(tx: Tx, type: "COMMENT" | "MESSAGE", id: string) {
  if (type === "COMMENT") {
    const [c] = await tx
      .update(comments)
      .set({ reportCount: sql`${comments.reportCount} + 1` })
      .where(eq(comments.id, id))
      .returning();
    if (c && !c.isHidden && c.reportCount >= AUTO_HIDE_REPORT_THRESHOLD) {
      await tx.update(comments).set({ isHidden: true }).where(eq(comments.id, id));
      await adjustCount(tx, c.profileId, c.kind, -1);
    }
  } else {
    const [m] = await tx
      .update(groupMessages)
      .set({ reportCount: sql`${groupMessages.reportCount} + 1` })
      .where(eq(groupMessages.id, id))
      .returning();
    if (m && !m.isHidden && m.reportCount >= AUTO_HIDE_REPORT_THRESHOLD) {
      await tx.update(groupMessages).set({ isHidden: true }).where(eq(groupMessages.id, id));
    }
  }
}

type TargetInfo = NonNullable<ReportDto["target"]> & { ownerId: string | null };

async function describeTarget(type: ReportTarget, id: string): Promise<TargetInfo | null> {
  switch (type) {
    case "PROFILE": {
      const [p] = await db
        .select({ p: profiles, handle: users.handle, slug: bubbles.slug })
        .from(profiles)
        .innerJoin(users, eq(users.id, profiles.userId))
        .innerJoin(bubbles, eq(bubbles.id, profiles.bubbleId))
        .where(eq(profiles.id, id))
        .limit(1);
      return p
        ? {
            title: `Profile · ${p.p.displayName}`,
            body: p.p.bio,
            href: `/p/${p.p.id}`,
            hidden: p.p.isHidden,
            ownerHandle: p.handle,
            ownerId: p.p.userId,
          }
        : null;
    }
    case "COMMENT": {
      const [c] = await db
        .select({ c: comments, handle: users.handle })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorId))
        .where(eq(comments.id, id))
        .limit(1);
      return c
        ? {
            title: c.c.kind === "ADVICE" ? "Advice comment" : "Comment",
            body: c.c.body,
            href: `/p/${c.c.profileId}`,
            hidden: c.c.isHidden,
            ownerHandle: c.handle,
            ownerId: c.c.authorId,
          }
        : null;
    }
    case "MESSAGE": {
      const [m] = await db
        .select({ m: groupMessages, handle: users.handle, slug: bubbles.slug, group: groups.slug })
        .from(groupMessages)
        .innerJoin(users, eq(users.id, groupMessages.authorId))
        .innerJoin(groups, eq(groups.id, groupMessages.groupId))
        .innerJoin(bubbles, eq(bubbles.id, groups.bubbleId))
        .where(eq(groupMessages.id, id))
        .limit(1);
      return m
        ? {
            title: `Group message · #${m.group}`,
            body: m.m.body,
            href: `/b/${m.slug}?tab=groups&g=${m.group}`,
            hidden: m.m.isHidden,
            ownerHandle: m.handle,
            ownerId: m.m.authorId,
          }
        : null;
    }
    case "BUBBLE": {
      const [b] = await db
        .select({ b: bubbles, handle: users.handle })
        .from(bubbles)
        .leftJoin(users, eq(users.id, bubbles.createdById))
        .where(eq(bubbles.id, id))
        .limit(1);
      return b
        ? {
            title: `Bubble · ${b.b.name}`,
            body: b.b.description,
            href: `/b/${b.b.slug}`,
            hidden: b.b.isHidden,
            ownerHandle: b.handle,
            ownerId: b.b.createdById,
          }
        : null;
    }
  }
}

export async function listReports(status: "OPEN" | "ACTIONED" | "DISMISSED" = "OPEN"): Promise<ReportDto[]> {
  const rows = await db
    .select({ r: reports, reporter: users.handle })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  const counts = new Map<string, number>();
  if (rows.length) {
    const agg = await db
      .select({ targetId: reports.targetId, n: sql<number>`count(*)::int`.mapWith(Number) })
      .from(reports)
      .where(
        and(
          inArray(
            reports.targetId,
            rows.map((r) => r.r.targetId),
          ),
          eq(reports.status, "OPEN"),
        ),
      )
      .groupBy(reports.targetId);
    for (const a of agg) counts.set(a.targetId, a.n);
  }

  return Promise.all(
    rows.map(async ({ r, reporter }) => {
      const target = await describeTarget(r.targetType, r.targetId);
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reporter,
        reportCount: counts.get(r.targetId) ?? 0,
        target: target
          ? {
              title: target.title,
              body: target.body,
              href: target.href,
              hidden: target.hidden,
              ownerHandle: target.ownerHandle,
            }
          : null,
      };
    }),
  );
}

/** Admin moderation actions. Every action resolves all open reports on the same target. */
export async function resolveReport(
  admin: SessionUser,
  reportId: string,
  action: "dismiss" | "hide" | "restore" | "delete" | "ban",
) {
  const [r] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!r) throw notFound("Report not found.");
  const target = await describeTarget(r.targetType, r.targetId);

  await db.transaction(async (tx) => {
    if (target) {
      if (action === "hide" || action === "restore") await setHidden(tx, r.targetType, r.targetId, action === "hide");
      if (action === "delete") await deleteTarget(tx, r.targetType, r.targetId);
      if (action === "ban" && target.ownerId) {
        await tx.update(users).set({ bannedAt: new Date() }).where(eq(users.id, target.ownerId));
        await tx.update(profiles).set({ isHidden: true }).where(eq(profiles.userId, target.ownerId));
        await setHidden(tx, r.targetType, r.targetId, true);
      }
    }
    await tx
      .update(reports)
      .set({
        status: action === "dismiss" || action === "restore" ? "DISMISSED" : "ACTIONED",
        resolvedById: admin.id,
        resolvedAt: new Date(),
      })
      .where(and(eq(reports.targetType, r.targetType), eq(reports.targetId, r.targetId), eq(reports.status, "OPEN")));
  });
  if (action === "ban" && target?.ownerId) await destroyAllSessions(target.ownerId);
  return { ok: true };
}

async function setHidden(tx: Tx, type: ReportTarget, id: string, hidden: boolean) {
  if (type === "PROFILE") await tx.update(profiles).set({ isHidden: hidden }).where(eq(profiles.id, id));
  if (type === "BUBBLE") await tx.update(bubbles).set({ isHidden: hidden }).where(eq(bubbles.id, id));
  if (type === "MESSAGE") await tx.update(groupMessages).set({ isHidden: hidden }).where(eq(groupMessages.id, id));
  if (type === "COMMENT") {
    const [c] = await tx.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (c && c.isHidden !== hidden) {
      await tx.update(comments).set({ isHidden: hidden }).where(eq(comments.id, id));
      await adjustCount(tx, c.profileId, c.kind, hidden ? -1 : 1);
    }
  }
}

async function deleteTarget(tx: Tx, type: ReportTarget, id: string) {
  if (type === "PROFILE") await tx.delete(profiles).where(eq(profiles.id, id));
  if (type === "BUBBLE") await tx.delete(bubbles).where(eq(bubbles.id, id));
  if (type === "MESSAGE") await tx.delete(groupMessages).where(eq(groupMessages.id, id));
  if (type === "COMMENT") {
    const [c] = await tx.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (c) await removeComment(tx, c);
  }
}
