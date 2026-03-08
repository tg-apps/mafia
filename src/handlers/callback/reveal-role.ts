import type { Context } from "grammy";

import type { LivePlayerData } from "#db/schema";
import { getUserDisplayName } from "#utils/user";

export async function handleRevealRole(
  ctx: Context,
  {
    player,
    players,
    userId,
  }: { player: LivePlayerData; players: LivePlayerData[]; userId: number },
) {
  let text = `🃏 Your role: **${player.role.toUpperCase()}**`;

  if (player.role === "mafia") {
    const others =
      players
        .filter((p) => p.userId !== userId && p.role === "mafia" && p.alive)
        .map(({ userId }) => getUserDisplayName(userId))
        .join(", ") || "none";
    text += `\nOther Mafia: ${others}`;
  }

  text += player.alive ? "\nYou are alive." : "\nYou are dead.";
  await ctx.answerCallbackQuery({ text, show_alert: true });
}
