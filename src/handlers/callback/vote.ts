import { eq, and, count } from "drizzle-orm";
import { Context, InlineKeyboard } from "grammy";

import { db, schema } from "#db";
import type { LivePlayerData } from "#db/schema";
import { checkWin, startNight } from "#game";
import { getUserDisplayName } from "#utils/user";

async function updateDayProgress(
  ctx: Context,
  players: LivePlayerData[],
  gameId: number,
) {
  const alivePlayers = players.filter((p) => p.alive);

  const [voteData] = await db
    .select({ value: count() })
    .from(schema.liveDayVotes)
    .where(eq(schema.liveDayVotes.gameId, gameId));

  const voted = voteData?.value ?? 0;
  const alive = alivePlayers.length;
  const text = `☀️ **Day phase**\nVotes cast: ${voted}/${alive}`;

  const keyboard = new InlineKeyboard();
  alivePlayers.forEach(({ userId }) =>
    keyboard.text(getUserDisplayName(userId), `vote:${userId}`).row(),
  );

  await ctx.reply(text, { parse_mode: "MarkdownV2", reply_markup: keyboard });
}

async function processDayLynch(
  ctx: Context,
  { players, gameId }: { players: LivePlayerData[]; gameId: number },
) {
  const votes = await db
    .select()
    .from(schema.liveDayVotes)
    .where(eq(schema.liveDayVotes.gameId, gameId));

  const voteCounts: Record<number, number> = {};
  for (const vote of votes) {
    voteCounts[vote.votingForId] = (voteCounts[vote.votingForId] || 0) + 1;
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
    await ctx.reply("☀️ No one was voted out.");
  } else {
    const lynchId = candidates[Math.floor(Math.random() * candidates.length)]!;

    await db
      .update(schema.livePlayers)
      .set({ alive: false })
      .where(
        and(
          eq(schema.livePlayers.gameId, gameId),
          eq(schema.livePlayers.userId, lynchId),
        ),
      );

    const lynched = players.find((p) => p.userId === lynchId);
    if (lynched) {
      await ctx.reply(
        `☀️ **${getUserDisplayName(lynched.userId)}** was lynched.\nRole: **${lynched.role.toUpperCase()}**`,
        { parse_mode: "MarkdownV2" },
      );
    }
  }

  await db
    .delete(schema.liveDayVotes)
    .where(eq(schema.liveDayVotes.gameId, gameId));

  const updatedPlayers = await db
    .select()
    .from(schema.livePlayers)
    .where(eq(schema.livePlayers.gameId, gameId));

  const isWin = await checkWin(ctx, { gameId, players: updatedPlayers });

  if (isWin) return;

  await startNight(ctx, gameId);
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
): Promise<true> {
  const targetId = parseInt(data.slice(5));
  const voter = players.find((p) => p.userId === userId && p.alive);
  const target = players.find((p) => p.userId === targetId && p.alive);

  if (!voter) return ctx.answerCallbackQuery("You can't vote right now.");
  if (!target) return ctx.answerCallbackQuery("Invalid target.");

  await db
    .insert(schema.liveDayVotes)
    .values({
      userId,
      gameId,
      votingForId: targetId,
    })
    .onConflictDoUpdate({
      target: [schema.liveDayVotes.gameId, schema.liveDayVotes.userId],
      set: { votingForId: targetId },
    });

  await ctx.answerCallbackQuery(`Voted for ${getUserDisplayName(targetId)}.`);
  await updateDayProgress(ctx, players, gameId);

  const aliveCount = players.filter((p) => p.alive).length;
  const [currentVotes] = await db
    .select({ value: count() })
    .from(schema.liveDayVotes)
    .where(eq(schema.liveDayVotes.gameId, gameId));

  if ((currentVotes?.value ?? 0) >= aliveCount) {
    await processDayLynch(ctx, { players, gameId });
  }

  return true;
}
