import { eq } from "drizzle-orm";
import { Context, InlineKeyboard } from "grammy";

import { db } from "#db";
import { liveGames, type LivePlayerData } from "#db/schema";
import { getUserDisplayName } from "#utils/user";

async function endGame(ctx: Context, gameId: number) {
  await ctx.reply("Game ended.");
  await db.delete(liveGames).where(eq(liveGames.id, gameId));
}

export async function checkWin(
  ctx: Context,
  { gameId, players }: { players: LivePlayerData[]; gameId: number },
) {
  const aliveMafia = players.filter(
    (p) => p.alive && p.role === "mafia",
  ).length;

  const aliveVill = players.filter(
    (p) => p.alive && p.role === "villager",
  ).length;

  if (aliveMafia === 0) {
    await ctx.reply("🎉 Villagers win! All Mafia eliminated.");
    await endGame(ctx, gameId);
    return true;
  }
  if (aliveMafia >= aliveVill && aliveVill > 0) {
    await ctx.reply("😈 Mafia win! They outnumber/equal villagers.");
    await endGame(ctx, gameId);
    return true;
  }
  return false;
}

export async function startNight(ctx: Context, gameId: number) {
  const players = await db.query.livePlayers.findMany({
    where: (livePlayers, { eq }) => eq(livePlayers.gameId, gameId),
  });

  const aliveMafia = players.filter((p) => p.alive && p.role === "mafia");

  const aliveVill = players.filter((p) => p.alive && p.role === "villager");

  if (aliveVill.length === 0 || aliveMafia.length === 0) {
    await checkWin(ctx, { gameId, players });
    return;
  }

  const keyboard = new InlineKeyboard();
  aliveVill.forEach(({ userId }) => {
    keyboard.text(getUserDisplayName(userId), `kill:${userId}`).row();
  });

  await ctx.reply(
    "🌙 **Night phase**\nMafia: choose target to kill (only your clicks count)\nVotes: 0/" +
      aliveMafia.length,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
}
