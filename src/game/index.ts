import { InlineKeyboard } from "grammy";

import { getUserDisplayName } from "#utils/user";

async function endGame(chatId: number) {
  await bot.api.sendMessage(chatId, "Game ended.");
  games.delete(chatId);
}

export function checkWin(game, chatId: number) {
  const aliveMafia = game.players.filter(
    (p) => p.alive && p.role === "mafia",
  ).length;
  const aliveVill = game.players.filter(
    (p) => p.alive && p.role === "villager",
  ).length;

  if (aliveMafia === 0) {
    bot.api.sendMessage(chatId, "🎉 Villagers win! All Mafia eliminated.");
    endGame(chatId);
    return true;
  }
  if (aliveMafia >= aliveVill && aliveVill > 0) {
    bot.api.sendMessage(
      chatId,
      "😈 Mafia win! They outnumber/equal villagers.",
    );
    endGame(chatId);
    return true;
  }
  return false;
}

export async function startNight(gameId: number, chatId: number) {
  game.mafiaVotes = new Map();

  const aliveMafia = game.players.filter((p) => p.alive && p.role === "mafia");
  const aliveVill = game.players.filter(
    (p) => p.alive && p.role === "villager",
  );
  if (aliveVill.length === 0 || aliveMafia.length === 0) {
    checkWin(game, chatId);
    return;
  }

  const keyboard = new InlineKeyboard();
  aliveVill.forEach((v) => {
    keyboard.text(getUserDisplayName(v), `kill_${v.id}`).row();
  });

  await bot.api.sendMessage(
    chatId,
    "🌙 **Night phase**\nMafia: choose target to kill (only your clicks count)\nVotes: 0/" +
      aliveMafia.length,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
}
