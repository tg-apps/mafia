import type { Context } from "grammy";
import type { Chat } from "grammy/types";

import { db } from "#db";
import { lobbyGames } from "#db/schema";

export async function handleNewGame(ctx: Context & { chat: Chat }) {
  if (!["group", "supergroup"].includes(ctx.chat.type)) {
    return ctx.reply("Use in group.");
  }

  const chatId = ctx.chat.id;

  const lobbyGame = await db.query.lobbyGames.findFirst({
    where: (lobbyGames, { eq }) => eq(lobbyGames.chatId, chatId),
  });

  if (lobbyGame) return ctx.reply("Lobby already exists. Use /join to join.");

  const liveGame = await db.query.liveGames.findFirst({
    where: (liveGames, { eq }) => eq(liveGames.chatId, chatId),
  });

  if (liveGame) return ctx.reply("Game already running. Wait for next game.");

  await db.insert(lobbyGames).values({ chatId });

  await ctx.reply("🃏 Mafia lobby created! /join to play. Min 4 players.");
}
