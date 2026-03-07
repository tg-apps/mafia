// import { db } from "#db";

import type { User } from "grammy/types";

// export function getUserDisplayName(userId: number): string {
//   const user = db.query.users
//     .findFirst({ where: (users, { eq }) => eq(users.userId, userId) })
//     .sync();
//   if (!user) return `User ${userId}`;
//   return user.username ? `@${user.username}` : user.firstName;
// }

export function getUserDisplayName(user: User): string {
  return user.username ? `@${user.username}` : user.first_name;
}
