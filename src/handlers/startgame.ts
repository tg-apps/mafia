import { eq } from "drizzle-orm";
import { InlineKeyboard, type Context } from "grammy";
import type { Chat } from "grammy/types";

import { db } from "#db";
import { liveGames, livePlayers, lobbyGames, lobbyPlayers } from "#db/schema";
import { startNight } from "#game";
import { getRoles } from "#utils/get-roles";

import { MIN_PLAYERS } from "../constants";

export async function handleStartGame(ctx: Context & { chat: Chat }) {
  const chatId = ctx.chat.id;

  const game = await db.query.lobbyGames.findFirst({
    where: (lobbyGames, { eq }) => eq(lobbyGames.chatId, chatId),
  });

  if (!game) return ctx.reply("No lobby.");

  const gameId = game.id;

  const players = await db.query.lobbyPlayers.findMany({
    where: (lobbyPlayers, { eq }) => eq(lobbyPlayers.gameId, gameId),
  });

  if (players.length < MIN_PLAYERS) {
    return ctx.reply(`Need at least ${MIN_PLAYERS} players to start a game.`);
  }

  const roles = getRoles(players.length);

  // Create live game
  await db.insert(liveGames).values({ chatId, status: "night" });

  // Delete lobby game
  await db.delete(lobbyGames).where(eq(lobbyGames.chatId, chatId));

  // Delete lobby players
  await db.delete(lobbyPlayers).where(eq(lobbyPlayers.gameId, gameId));

  // Create live players
  players.forEach(({ userId }, i) => {
    db.insert(livePlayers).values({ userId, gameId, role: roles[i]! }).run();
  });

  await ctx.reply("🎮 Game starting! Roles assigned secretly.");

  const keyboard = new InlineKeyboard().text("Reveal my role", "reveal_role");
  await ctx.reply("🃏 Click to see your role", { reply_markup: keyboard });

  await startNight(gameId, chatId);
}
