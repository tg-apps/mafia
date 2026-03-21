import type { Context } from "grammy";

import type { LivePlayerData } from "#db/schema";

export async function handleRevealRole(
  ctx: Context,
  { player }: { player: LivePlayerData },
) {
  let text = `🃏 Your role: ${player.role}`;
  text += player.alive ? "\nYou are alive." : "\nYou are dead.";
  await ctx.answerCallbackQuery({ text, show_alert: true });
}
