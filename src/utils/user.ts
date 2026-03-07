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

export function getUserDisplayName(user: User): string {
  return user.username ? `@${user.username}` : user.first_name;
}
