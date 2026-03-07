import { InlineKeyboard, type Context } from "grammy";
import type { Chat } from "grammy/types";

import { db } from "#db";
import { liveGames, players } from "#db/schema";
import { startNight } from "#game";
import { shuffle } from "#utils/shuffle";

import { MIN_PLAYERS } from "../constants";

export async function handleStartGame(ctx: Context & { chat: Chat }) {
  const chatId = ctx.chat.id;

  const game = await db.query.lobbyGames.findFirst({
    where: (lobbyGames, { eq }) => eq(lobbyGames.chatId, chatId),
  });

  if (!game) return ctx.reply("No lobby.");

  if (game.players.length < MIN_PLAYERS) {
    return ctx.reply(`Need at least ${MIN_PLAYERS} players to start a game.`);
  }

  const mafiaCount = Math.max(1, Math.floor(game.players.length / 3));

  const roles = shuffle(
    Array(mafiaCount)
      .fill("mafia")
      .concat(Array(game.players.length - mafiaCount).fill("villager")),
  );

  db.insert(liveGames).values({ chatId, status: "night" });

  game.players.forEach((userId, i) => {
    db.insert(players).values({
      userId,
      gameId: game.id,
      role: roles[i],
    });
  });

  await ctx.reply("🎮 Game starting! Roles assigned secretly.");

  const keyboard = new InlineKeyboard().text("Reveal my role", "reveal_role");
  await ctx.reply("🃏 Click to see your role", { reply_markup: keyboard });

  await startNight(game.id, chatId);
}
