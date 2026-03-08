import type { Context } from "grammy";
import type { Chat, User } from "grammy/types";

import { db } from "#db";
import { lobbyPlayers } from "#db/schema";
import { getUserDisplayName, upsertUser } from "#utils/user";

export async function handleJoin(ctx: Context & { chat: Chat; from: User }) {
  upsertUser(ctx.from);

  if (!["group", "supergroup"].includes(ctx.chat.type)) return;

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const game = await db.query.lobbyGames.findFirst({
    where: (lobbyGames, { eq }) => eq(lobbyGames.chatId, chatId),
  });

  if (!game) return ctx.reply("No lobby. Use /newgame to create one.");

  const gameId = game.id;

  const players = await db.query.lobbyPlayers.findMany({
    where: (lobbyPlayers, { eq }) => eq(lobbyPlayers.gameId, gameId),
  });

  if (players.some((p) => p.userId === userId)) {
    return ctx.reply("Already joined.");
  }

  const total = await db
    .insert(lobbyPlayers)
    .values({ userId, gameId })
    .onConflictDoNothing()
    .returning();

  await ctx.reply(
    `✅ ${getUserDisplayName(ctx.from)} joined! (${total.length} total)`,
  );
}
