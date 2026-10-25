"use server";

import { and, count, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { defineAction } from "../action";

const ALL_ROLES = ["admin", "staff", "guide"] as const;
const PAGE = 20;

/** BR-09-8: the bell shows the last 30 days. */
const since = () => new Date(Date.now() - 30 * 86_400_000).toISOString();

export const getUnreadCount = defineAction({ roles: ALL_ROLES, input: z.object({}) }, async (_input, me) => {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientUserId, me.id), isNull(notifications.readAt), gte(notifications.createdAt, since())));
  return row.n;
});

/** 09 §6 listMyNotifications: newest first, 20 per page (cursor = createdAt of the last row). */
export const listMyNotifications = defineAction(
  { roles: ALL_ROLES, input: z.object({ cursor: z.string().optional() }) },
  async ({ cursor }, me) => {
    const rows = await db
      .select({
        id: notifications.id,
        eventKey: notifications.eventKey,
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, me.id),
          gte(notifications.createdAt, since()),
          cursor ? lt(notifications.createdAt, cursor) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE + 1);
    return { items: rows.slice(0, PAGE), hasMore: rows.length > PAGE };
  },
);

/** BR-09-6: users only mark their own rows. */
export const markNotificationRead = defineAction({ roles: ALL_ROLES, input: z.object({ id: z.string() }) }, async ({ id }, me) => {
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, me.id), isNull(notifications.readAt)));
  return null;
});

export const markAllNotificationsRead = defineAction({ roles: ALL_ROLES, input: z.object({}) }, async (_input, me) => {
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.recipientUserId, me.id), isNull(notifications.readAt)));
  return null;
});
