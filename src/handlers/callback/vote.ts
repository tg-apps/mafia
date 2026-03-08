import { Context, InlineKeyboard } from "grammy";

import type { LivePlayerData } from "#db/schema";
import { checkWin, startNight } from "#game";
import { getUserDisplayName } from "#utils/user";

async function updateDayProgress(ctx: Context, players: LivePlayerData[]) {
  const alive = players.filter((p) => p.alive).length;
  const voted = game.dayVotes.size;
  const text = `☀️ **Day phase**\nVotes cast: ${voted}/${alive}`;

  const alivePlayers = players.filter((p) => p.alive);
  const keyboard = new InlineKeyboard();
  alivePlayers.forEach(({ userId }) =>
    keyboard.text(getUserDisplayName(userId), `vote:${userId}`).row(),
  );

  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
}

async function processDayLynch(
  ctx: Context,
  { players, gameId }: { players: LivePlayerData[]; gameId: number },
) {
  const voteCounts: Record<number, number> = {};
  for (const targetId of game.dayVotes.values()) {
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
    await ctx.reply("☀️ No lynch.");
  } else {
    const lynchId = candidates[Math.floor(Math.random() * candidates.length)];
    const lynched = players.find((p) => p.userId === lynchId);
    if (lynched) {
      lynched.alive = false;
      await ctx.reply(
        `☀️ **${getUserDisplayName(lynched.userId)}** was lynched.\nRole: **${lynched.role.toUpperCase()}**`,
      );
    }
  }

  if (!checkWin(ctx, { gameId, players })) {
    await startNight(ctx, gameId);
  }
}

export async function handleVote(
  ctx: Context,
  {
    userId,
    data,
    players,
    gameId,
  }: {
    userId: number;
    data: string;
    players: LivePlayerData[];
    gameId: number;
  },
) {
  const targetId = parseInt(data.slice(5));

  const target = players.find((p) => p.userId === targetId && p.alive);

  if (!target) return ctx.answerCallbackQuery("Invalid target.");

  game.dayVotes.set(userId, targetId);
  await ctx.answerCallbackQuery(`Voted for ${getUserDisplayName(targetId)}.`);

  await updateDayProgress(ctx, players);

  const aliveCount = players.filter((p) => p.alive).length;

  if (game.dayVotes.size === aliveCount) {
    await processDayLynch(ctx, { players, gameId });
  }
}
