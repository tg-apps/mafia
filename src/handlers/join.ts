import { eq } from "drizzle-orm";
import type { Context } from "grammy";
import type { Chat, User } from "grammy/types";

import { db } from "#db";
import { lobbyGames } from "#db/schema";
import { getUserDisplayName } from "#utils/user";

export async function handleJoin(ctx: Context & { chat: Chat; from: User }) {
  if (!["group", "supergroup"].includes(ctx.chat.type)) return;

  const chatId = ctx.chat.id;

  const game = await db.query.lobbyGames.findFirst({
    where: (lobbyGames, { eq }) => eq(lobbyGames.chatId, chatId),
  });

  if (!game) return ctx.reply("No lobby.");

  if (game.players.some((userId) => userId === ctx.from.id)) {
    return ctx.reply("Already joined.");
  }

  db.update(lobbyGames)
    .set({ players: game.players.concat(ctx.from.id) })
    .where(eq(lobbyGames.id, game.id));

  await ctx.reply(
    `✅ ${getUserDisplayName(ctx.from)} joined! (${game.players.length} total)`,
  );
}
