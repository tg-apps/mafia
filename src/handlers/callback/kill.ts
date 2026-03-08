import { eq } from "drizzle-orm";
import { Context, InlineKeyboard } from "grammy";

import { db } from "#db";
import { liveGames, type LivePlayerData } from "#db/schema";
import { checkWin } from "#game";
import { getUserDisplayName } from "#utils/user";

async function startDay(
  ctx: Context,
  { gameId, players }: { gameId: number; players: LivePlayerData[] },
) {
  await db
    .update(liveGames)
    .set({ status: "day" })
    .where(eq(liveGames.id, gameId));

  const alive = players.filter((p) => p.alive);

  if (alive.length <= 1) {
    await checkWin(ctx, { players, gameId });
    return;
  }

  const keyboard = new InlineKeyboard();
  alive.forEach(({ userId }) =>
    keyboard.text(getUserDisplayName(userId), `vote:${userId}`).row(),
  );

  await ctx.reply(
    `☀️ **Day phase**\nVote to lynch (click button)\nVotes: 0/${alive.length}`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
}

async function processNightKill(
  ctx: Context,
  { gameId, players }: { gameId: number; players: LivePlayerData[] },
) {
  const voteCounts: Record<number, number> = {};

  for (const targetId of game.mafiaVotes.values()) {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  }
  let max = 0;
  let candidates: number[] = [];
  for (const [tid, c] of Object.entries(voteCounts)) {
    const t = parseInt(tid);
    if (c > max) {
      max = c;
      candidates = [t];
    } else if (c === max) candidates.push(t);
  }
  if (candidates.length === 0) {
    await ctx.reply("🌙 No kill tonight.");
  } else {
    const killId = candidates[Math.floor(Math.random() * candidates.length)];
    const killed = players.find((p) => p.userId === killId);
    if (killed) {
      killed.alive = false;
      await ctx.reply(
        `🌙 **${getUserDisplayName(killed.userId)}** was killed.\nRole: **${killed.role.toUpperCase()}**`,
      );
    }
  }

  if (!(await checkWin(ctx, { gameId, players }))) {
    await startDay(ctx, { gameId, players });
  }
}

async function updateNightProgress({
  ctx,
  players,
}: {
  ctx: Context;
  players: LivePlayerData[];
}) {
  const aliveMafia = players.filter(
    (p) => p.alive && p.role === "mafia",
  ).length;

  const voted = game.mafiaVotes.size;
  const text = `🌙 **Night phase**\nMafia votes: ${voted}/${aliveMafia}`;

  const aliveVill = players.filter((p) => p.alive && p.role === "villager");
  const keyboard = new InlineKeyboard();
  aliveVill.forEach(({ userId }) =>
    keyboard.text(getUserDisplayName(userId), `kill:${userId}`).row(),
  );

  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
}

export async function handleKill(
  ctx: Context,
  {
    player,
    userId,
    data,
    gameId,
    players,
  }: {
    player: LivePlayerData;
    gameId: number;
    data: string;
    userId: number;
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

  game.mafiaVotes.set(userId, targetId);
  await ctx.answerCallbackQuery(
    `You voted to kill ${getUserDisplayName(targetId)}.`,
  );

  await updateNightProgress({ ctx, players });

  const mafiaAlive = players.filter(
    (p) => p.alive && p.role === "mafia",
  ).length;

  if (game.mafiaVotes.size === mafiaAlive) {
    await processNightKill(ctx, { gameId, players });
  }
}
