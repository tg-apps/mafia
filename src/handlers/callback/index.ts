import type { Context } from "grammy";
import type { CallbackQuery, User } from "grammy/types";

import { db } from "#db";

import { handleKill } from "./kill";
import { handleRevealRole } from "./reveal-role";
import { handleVote } from "./vote";

export async function handleCallback(
  ctx: Context & { callbackQuery: CallbackQuery; from: User },
) {
  const data = ctx.callbackQuery.data || "";
  const userId = ctx.from.id;
  const chatId = ctx.chat!.id;

  const game = await db.query.liveGames.findFirst({
    where: (liveGames, { eq }) => eq(liveGames.chatId, chatId),
  });

  if (!game) return ctx.answerCallbackQuery("No game here.");

  const player = await db.query.players.findFirst({
    where: (players, { eq, and }) =>
      and(eq(players.gameId, game.id), eq(players.userId, userId)),
  });

  if (!player || !player.alive) {
    return ctx.answerCallbackQuery("You are not alive.");
  }

  if (data === "reveal_role") {
    handleRevealRole({ player, game, ctx, userId });
    return;
  }

  if (data.startsWith("kill_") && game.status === "night") {
    handleKill({ player, game, ctx, userId, data });
    return;
  }

  if (data.startsWith("vote_") && game.status === "day") {
    handleVote({ chatId, game, ctx, userId, data });
    return;
  }
}
