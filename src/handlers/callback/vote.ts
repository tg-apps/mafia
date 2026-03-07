import { InlineKeyboard } from "grammy";

import { checkWin, startNight } from "#game";
import { getUserDisplayName } from "#utils/user";

async function updateDayProgress(game, chatId: number) {
  if (!game.dayProgressMsgId) return;

  const alive = game.players.filter((p) => p.alive).length;
  const voted = game.dayVotes.size;
  const text = `☀️ **Day phase**\nVotes cast: ${voted}/${alive}`;

  const alivePlayers = game.players.filter((p) => p.alive);
  const keyboard = new InlineKeyboard();
  alivePlayers.forEach((p) =>
    keyboard.text(getUserDisplayName(p), `vote_${p.id}`).row(),
  );

  try {
    await bot.api.editMessageText(chatId, game.dayProgressMsgId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch {
    const newSent = await bot.api.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    game.dayProgressMsgId = newSent.message_id;
  }
}

async function processDayLynch(game, chatId: number) {
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
    await bot.api.sendMessage(chatId, "☀️ No lynch.");
  } else {
    const lynchId = candidates[Math.floor(Math.random() * candidates.length)];
    const lynched = game.players.find((p) => p.id === lynchId);
    if (lynched) {
      lynched.alive = false;
      await bot.api.sendMessage(
        chatId,
        `☀️ **${getUserDisplayName(lynched)}** was lynched.\nRole: **${lynched.role.toUpperCase()}**`,
      );
    }
  }
  if (!checkWin(game, chatId)) await startNight(game, chatId);
}

export async function handleVote({ game, ctx, userId, data, chatId }) {
  const targetId = parseInt(data.slice(5));

  const target = game.players.find((p) => p.id === targetId && p.alive);

  if (!target) return ctx.answerCallbackQuery("Invalid target.");

  game.dayVotes.set(userId, targetId);
  await ctx.answerCallbackQuery(`Voted for ${getUserDisplayName(target)}.`);

  await updateDayProgress(game, chatId);

  const aliveCount = game.players.filter((p) => p.alive).length;
  if (game.dayVotes.size === aliveCount) {
    await processDayLynch(game, chatId);
  }
}
