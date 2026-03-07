import type { LiveGameData, PlayerData } from "#db/schema";
import { getUserDisplayName } from "#utils/user";

export async function handleRevealRole({
  player,
  game,
  ctx,
  userId,
}: {
  player: PlayerData;
  game: LiveGameData;
  ctx;
  userId: number;
}) {
  let text = `🃏 Your role: **${player.role.toUpperCase()}**`;

  if (player.role === "mafia") {
    const others =
      game.players
        .filter((p) => p.id !== userId && p.role === "mafia" && p.alive)
        .map(getUserDisplayName)
        .join(", ") || "none";
    text += `\nOther Mafia: ${others}`;
  }

  text += player.alive ? "\nYou are alive." : "\nYou are dead.";
  await ctx.answerCallbackQuery({ text, show_alert: true });
}
