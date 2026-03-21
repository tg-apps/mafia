import type { Context } from "grammy";
import type { CallbackQuery, User } from "grammy/types";

import { db } from "#db";
import { upsertUser } from "#utils/user";

import { handleKill } from "./kill";
import { handleRevealRole } from "./reveal-role";
import { handleVote } from "./vote";

export async function handleCallback(
  ctx: Context & { callbackQuery: CallbackQuery; from: User },
): Promise<true> {
  if (!ctx.chat || !ctx.callbackQuery.data) return true;

  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  upsertUser(ctx.from);

  const game = await db.query.liveGames.findFirst({
    where: (liveGames, { eq }) => eq(liveGames.chatId, chatId),
  });

  if (!game) return ctx.answerCallbackQuery("No game here.");

  const gameId = game.id;

  const players = await db.query.livePlayers.findMany({
    where: (livePlayers, { eq }) => eq(livePlayers.gameId, gameId),
  });

  const player = players.find((p) => p.userId === userId);

  if (!player || !player.alive) {
    return ctx.answerCallbackQuery("You are not alive.");
  }

  if (data === "reveal_role") {
    return await handleRevealRole(ctx, { player });
  }

  if (data.startsWith("kill:") && game.status === "night") {
    return await handleKill(ctx, { player, data, gameId, players });
  }

  if (data.startsWith("vote:") && game.status === "day") {
    return await handleVote(ctx, { userId, data, players, gameId });
  }

  return await ctx.answerCallbackQuery("Action not available right now.");
}
