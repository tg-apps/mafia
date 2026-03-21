import { eq } from "drizzle-orm";
import { InlineKeyboard, type Context } from "grammy";
import type { Chat } from "grammy/types";

import { MIN_PLAYERS } from "#constants";
import { db } from "#db";
import { liveGames, livePlayers, lobbyGames, lobbyPlayers } from "#db/schema";
import { startNight } from "#game";
import { getRoles } from "#utils/get-roles";

export async function handleStartGame(ctx: Context & { chat: Chat }) {
  const chatId = ctx.chat.id;

  const lobby = await db.query.lobbyGames.findFirst({
    where: (lobbyGames, { eq }) => eq(lobbyGames.chatId, chatId),
  });

  if (!lobby) return ctx.reply("No lobby.");

  const lobbyId = lobby.id;

  const players = await db.query.lobbyPlayers.findMany({
    where: (lobbyPlayers, { eq }) => eq(lobbyPlayers.gameId, lobbyId),
  });

  if (players.length < MIN_PLAYERS) {
    return ctx.reply(`Need at least ${MIN_PLAYERS} players to start a game.`);
  }

  const roles = getRoles(players.length);

  // Create live game
  const game = db
    .insert(liveGames)
    .values({ chatId, status: "night" })
    .returning()
    .get();

  // Delete lobby game
  await db.delete(lobbyGames).where(eq(lobbyGames.chatId, chatId));

  // Delete lobby players
  await db.delete(lobbyPlayers).where(eq(lobbyPlayers.gameId, lobbyId));

  // Create live players
  players.forEach(({ userId }, i) => {
    db.insert(livePlayers)
      .values({ userId, gameId: game.id, role: roles[i]! })
      .run();
  });

  await ctx.reply("🎮 Game starting! Roles assigned secretly.");

  const keyboard = new InlineKeyboard().text("Reveal my role", "reveal_role");
  await ctx.reply("🃏 Click to see your role", { reply_markup: keyboard });

  await startNight(ctx, game.id);
}
