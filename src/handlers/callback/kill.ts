import { InlineKeyboard } from "grammy";

import { checkWin } from "#game";
import { getUserDisplayName } from "#utils/user";

async function startDay(gameId: number, chatId: number) {
  game.status = "day";
  game.dayVotes = new Map();

  const alive = game.players.filter((p) => p.alive);
  if (alive.length <= 1) {
    checkWin(game, chatId);
    return;
  }

  const keyboard = new InlineKeyboard();
  alive.forEach((p) =>
    keyboard.text(getUserDisplayName(p), `vote_${p.id}`).row(),
  );

  const sent = await bot.api.sendMessage(
    chatId,
    `☀️ **Day phase**\nVote to lynch (click button)\nVotes: 0/${alive.length}`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
  game.dayProgressMsgId = sent.message_id;
}

async function processNightKill(game, chatId: number) {
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
    await bot.api.sendMessage(chatId, "🌙 No kill tonight.");
  } else {
    const killId = candidates[Math.floor(Math.random() * candidates.length)];
    const killed = game.players.find((p) => p.id === killId);
    if (killed) {
      killed.alive = false;
      await bot.api.sendMessage(
        chatId,
        `🌙 **${getUserDisplayName(killed)}** was killed.\nRole: **${killed.role.toUpperCase()}**`,
      );
    }
  }
  if (!checkWin(game, chatId)) await startDay(game, chatId);
}

async function updateNightProgress(game, chatId: number) {
  if (!game.nightProgressMsgId) return;

  const aliveMafia = game.players.filter(
    (p) => p.alive && p.role === "mafia",
  ).length;
  const voted = game.mafiaVotes.size;
  const text = `🌙 **Night phase**\nMafia votes: ${voted}/${aliveMafia}`;

  const aliveVill = game.players.filter(
    (p) => p.alive && p.role === "villager",
  );
  const keyboard = new InlineKeyboard();
  aliveVill.forEach((v) =>
    keyboard.text(getDisplayName(v), `kill_${v.id}`).row(),
  );

  try {
    await bot.api.editMessageText(chatId, game.nightProgressMsgId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch {
    // fallback: send new if edit fails
    const newSent = await bot.api.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    game.nightProgressMsgId = newSent.message_id;
  }
}

export async function handleKill({ player, game, ctx, userId, data }) {
  if (player.role !== "mafia")
    return ctx.answerCallbackQuery("Only Mafia can do this.");

  const targetId = parseInt(data.slice(5));
  const target = game.players.find(
    (p) => p.id === targetId && p.alive && p.role === "villager",
  );
  if (!target) return ctx.answerCallbackQuery("Invalid target.");

  game.mafiaVotes.set(userId, targetId);
  await ctx.answerCallbackQuery(
    `You voted to kill ${getUserDisplayName(target)}.`,
  );

  await updateNightProgress(game, chatId);

  const mafiaAlive = game.players.filter(
    (p) => p.alive && p.role === "mafia",
  ).length;
  if (game.mafiaVotes.size === mafiaAlive) {
    await processNightKill(game, chatId);
  }
}
