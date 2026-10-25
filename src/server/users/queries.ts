import "server-only";
import { and, asc, eq, like, or, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { guides, users, type Role } from "@/db/schema";

export type UserFilters = { q?: string; role?: Role; status?: "active" | "inactive" | "all" };

export async function listUsers(filters: UserFilters) {
  const conditions: SQL[] = [];
  if (filters.q) {
    const q = `%${filters.q.toLowerCase()}%`;
    conditions.push(or(like(users.name, q), like(users.email, q))!);
  }
  if (filters.role) conditions.push(eq(users.role, filters.role));
  const status = filters.status ?? "active";
  if (status !== "all") conditions.push(eq(users.isActive, status === "active"));

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      defaultChannel: users.defaultChannel,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      guideId: guides.id,
    })
    .from(users)
    .leftJoin(guides, eq(guides.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(users.name));
}

export async function getUser(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { passwordHash: false },
  });
}

export type UserListItem = Awaited<ReturnType<typeof listUsers>>[number];
