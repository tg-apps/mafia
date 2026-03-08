import type { User } from "grammy/types";

import { db } from "#db";
import { users, type UserData } from "#db/schema";

export function upsertUser(user: User): UserData {
  return db
    .insert(users)
    .values({
      userId: user.id,
      firstName: user.first_name,
      username: user.username,
    })
    .onConflictDoUpdate({
      target: users.userId,
      set: { firstName: user.first_name, username: user.username },
    })
    .returning()
    .get();
}

export function getUserDisplayName(userId: number | User): string {
  if (typeof userId !== "number") {
    return userId.username ? `@${userId.username}` : userId.first_name;
  }

  const user = db.query.users
    .findFirst({ where: (users, { eq }) => eq(users.userId, userId) })
    .sync();

  if (!user) return `User ${userId}`;

  return user.username ? `@${user.username}` : user.firstName;
}
