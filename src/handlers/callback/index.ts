import type { Context } from "grammy";
import type { CallbackQuery, User } from "grammy/types";

import { db } from "#db";
import { upsertUser } from "#utils/user";

import { handleKill } from "./kill";
import { handleRevealRole } from "./reveal-role";
import { handleVote } from "./vote";

export async function handleCallback(
  ctx: Context & { callbackQuery: CallbackQuery; from: User },
) {
  if (!ctx.chat || !ctx.callbackQuery.data) return;

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
    await handleRevealRole(ctx, { player });
    return;
  }

  if (data.startsWith("kill:") && game.status === "night") {
    await handleKill(ctx, { player, data, gameId, players });
    return;
  }

  if (data.startsWith("vote:") && game.status === "day") {
    await handleVote(ctx, { userId, data, players, gameId });
    return;
  }
}
