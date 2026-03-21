import { eq, and } from "drizzle-orm";
import { Context } from "grammy";

import { db } from "#db";
import { livePlayers, liveNightActions, type LivePlayerData } from "#db/schema";
import { checkWin, startDay } from "#game";
import { getUserDisplayName } from "#utils/user";

async function processNightKill(
  ctx: Context,
  { gameId, players }: { gameId: number; players: LivePlayerData[] },
) {
  const [action] = await db
    .select()
    .from(liveNightActions)
    .where(eq(liveNightActions.gameId, gameId))
    .limit(1);

  if (!action || !action.actionTowardsId) {
    await ctx.reply("🌙 The Mafia was indecisive. No kill tonight.");
  } else {
    const killId = action.actionTowardsId;

    await db
      .update(livePlayers)
      .set({ alive: false })
      .where(
        and(eq(livePlayers.gameId, gameId), eq(livePlayers.userId, killId)),
      );

    const killed = players.find((p) => p.userId === killId);
    if (killed) {
      await ctx.reply(
        `🌙 **${getUserDisplayName(killed.userId)}** was killed.\nRole: **${killed.role.toUpperCase()}**`,
      );
    }
  }

  await db.delete(liveNightActions).where(eq(liveNightActions.gameId, gameId));

  const updatedPlayers = await db
    .select()
    .from(livePlayers)
    .where(eq(livePlayers.gameId, gameId));

  const isWin = await checkWin(ctx, { gameId, players: updatedPlayers });
  if (isWin) return;

  await startDay(ctx, gameId);
}

export async function handleKill(
  ctx: Context,
  {
    player,
    data,
    gameId,
    players,
  }: {
    player: LivePlayerData;
    gameId: number;
    data: string;
    players: LivePlayerData[];
  },
) {
  if (player.role !== "mafia") {
    return ctx.answerCallbackQuery("Only Mafia can do this.");
  }

  const targetId = parseInt(data.slice(5));
  const target = players.find(
    (p) => p.userId === targetId && p.alive && p.role === "villager",
  );

  if (!target) return ctx.answerCallbackQuery("Invalid target.");

  await db
    .insert(liveNightActions)
    .values({
      userId: player.userId,
      gameId: gameId,
      actionTowardsId: targetId,
    })
    .onConflictDoUpdate({
      target: [liveNightActions.gameId, liveNightActions.userId],
      set: { actionTowardsId: targetId },
    });

  await ctx.answerCallbackQuery(
    `Target eliminated: ${getUserDisplayName(targetId)}.`,
  );

  await processNightKill(ctx, { gameId, players });
}
