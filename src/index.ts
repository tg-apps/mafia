import type { User } from "grammy/types";

import { run } from "@grammyjs/runner";
import { Bot, GrammyError, InlineKeyboard } from "grammy";

const TOKEN = process.env["TOKEN"];
if (!TOKEN) throw new Error("Missing TOKEN env variable");

const bot = new Bot(TOKEN);

const m = bot.on("message");

interface Player {
  id: number;
  first_name: string;
  username?: string;
  role: "mafia" | "villager" | null;
  alive: boolean;
}

interface PlayerWithRole extends Player {
  role: "mafia" | "villager";
}

interface GameLobby {
  status: "lobby";
  players: Player[];
}

interface GameOngoing {
  status: "night" | "day";
  players: PlayerWithRole[];
  dayVotes: Map<number, number>;
  mafiaVotes: Map<number, number>;
  nightProgressMsgId: number;
  dayProgressMsgId: number;
}

type Game = GameOngoing | GameLobby;

const games = new Map<number, Game>(); // groupId → game
const getDisplayName = (p: User | Player) =>
  p.first_name || p.username || `Player${p.id}`;

function shuffle<T>(array: T[]) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function endGame(groupId: number) {
  await bot.api.sendMessage(groupId, "Game ended.");
  games.delete(groupId);
}

function checkWin(game: Game, groupId: number) {
  const aliveMafia = game.players.filter(
    (p) => p.alive && p.role === "mafia",
  ).length;
  const aliveVill = game.players.filter(
    (p) => p.alive && p.role === "villager",
  ).length;

  if (aliveMafia === 0) {
    bot.api.sendMessage(groupId, "🎉 Villagers win! All Mafia eliminated.");
    endGame(groupId);
    return true;
  }
  if (aliveMafia >= aliveVill && aliveVill > 0) {
    bot.api.sendMessage(
      groupId,
      "😈 Mafia win! They outnumber/equal villagers.",
    );
    endGame(groupId);
    return true;
  }
  return false;
}

async function sendRevealButton(groupId: number) {
  const keyboard = new InlineKeyboard().text("Reveal my role", "reveal_role");
  await bot.api.sendMessage(
    groupId,
    "🃏 Click to reveal **your role** privately (popup):",
    { reply_markup: keyboard },
  );
}

async function startNight(game: Game, groupId: number) {
  game.status = "night";
  game.mafiaVotes = new Map();

  const aliveMafia = game.players.filter((p) => p.alive && p.role === "mafia");
  const aliveVill = game.players.filter(
    (p) => p.alive && p.role === "villager",
  );
  if (aliveVill.length === 0 || aliveMafia.length === 0) {
    checkWin(game, groupId);
    return;
  }

  const keyboard = new InlineKeyboard();
  aliveVill.forEach((v) => {
    keyboard.text(getDisplayName(v), `kill_${v.id}`).row();
  });

  const sent = await bot.api.sendMessage(
    groupId,
    "🌙 **Night phase**\nMafia: choose target to kill (only your clicks count)\nVotes: 0/" +
      aliveMafia.length,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    },
  );
  game.nightProgressMsgId = sent.message_id;
}

async function updateNightProgress(game: GameOngoing, groupId: number) {
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
    await bot.api.editMessageText(groupId, game.nightProgressMsgId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch {
    // fallback: send new if edit fails
    const newSent = await bot.api.sendMessage(groupId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    game.nightProgressMsgId = newSent.message_id;
  }
}

async function processNightKill(game: GameOngoing, groupId: number) {
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
    await bot.api.sendMessage(groupId, "🌙 No kill tonight.");
  } else {
    const killId = candidates[Math.floor(Math.random() * candidates.length)];
    const killed = game.players.find((p) => p.id === killId);
    if (killed) {
      killed.alive = false;
      await bot.api.sendMessage(
        groupId,
        `🌙 **${getDisplayName(killed)}** was killed.\nRole: **${killed.role.toUpperCase()}**`,
      );
    }
  }
  if (!checkWin(game, groupId)) await startDay(game, groupId);
}

async function startDay(game: GameOngoing, groupId: number) {
  game.status = "day";
  game.dayVotes = new Map();

  const alive = game.players.filter((p) => p.alive);
  if (alive.length <= 1) {
    checkWin(game, groupId);
    return;
  }

  const keyboard = new InlineKeyboard();
  alive.forEach((p) => keyboard.text(getDisplayName(p), `vote_${p.id}`).row());

  const sent = await bot.api.sendMessage(
    groupId,
    `☀️ **Day phase**\nVote to lynch (click button)\nVotes: 0/${alive.length}`,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    },
  );
  game.dayProgressMsgId = sent.message_id;
}

async function updateDayProgress(game: GameOngoing, groupId: number) {
  if (!game.dayProgressMsgId) return;
  const alive = game.players.filter((p) => p.alive).length;
  const voted = game.dayVotes.size;
  const text = `☀️ **Day phase**\nVotes cast: ${voted}/${alive}`;

  const alivePlayers = game.players.filter((p) => p.alive);
  const keyboard = new InlineKeyboard();
  alivePlayers.forEach((p) =>
    keyboard.text(getDisplayName(p), `vote_${p.id}`).row(),
  );

  try {
    await bot.api.editMessageText(groupId, game.dayProgressMsgId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch {
    const newSent = await bot.api.sendMessage(groupId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    game.dayProgressMsgId = newSent.message_id;
  }
}

async function processDayLynch(game: GameOngoing, groupId: number) {
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
    await bot.api.sendMessage(groupId, "☀️ No lynch.");
  } else {
    const lynchId = candidates[Math.floor(Math.random() * candidates.length)];
    const lynched = game.players.find((p) => p.id === lynchId);
    if (lynched) {
      lynched.alive = false;
      await bot.api.sendMessage(
        groupId,
        `☀️ **${getDisplayName(lynched)}** was lynched.\nRole: **${lynched.role.toUpperCase()}**`,
      );
    }
  }
  if (!checkWin(game, groupId)) await startNight(game, groupId);
}

bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data || "";
  const userId = ctx.from.id;
  const groupId = ctx.chat.id; // group chat
  const game = games.get(groupId);
  if (!game) return ctx.answerCallbackQuery("No game here.");

  const player = game.players.find((p) => p.id === userId);
  if (!player || !player.alive) {
    return ctx.answerCallbackQuery("You are not alive.");
  }

  if (data === "reveal_role") {
    let text = `🃏 Your role: **${player.role.toUpperCase()}**`;
    if (player.role === "mafia") {
      const others =
        game.players
          .filter((p) => p.id !== userId && p.role === "mafia" && p.alive)
          .map(getDisplayName)
          .join(", ") || "none";
      text += `\nOther Mafia: ${others}`;
    }
    text += player.alive ? "\nYou are alive." : "\nYou are dead.";
    await ctx.answerCallbackQuery({ text, show_alert: true });
    return;
  }

  if (data.startsWith("kill_") && game.status === "night") {
    if (player.role !== "mafia")
      return ctx.answerCallbackQuery("Only Mafia can do this.");
    const targetId = parseInt(data.slice(5));
    const target = game.players.find(
      (p) => p.id === targetId && p.alive && p.role === "villager",
    );
    if (!target) return ctx.answerCallbackQuery("Invalid target.");

    game.mafiaVotes.set(userId, targetId);
    await ctx.answerCallbackQuery(
      `You voted to kill ${getDisplayName(target)}.`,
    );

    await updateNightProgress(game, groupId);

    const mafiaAlive = game.players.filter(
      (p) => p.alive && p.role === "mafia",
    ).length;
    if (game.mafiaVotes.size === mafiaAlive) {
      await processNightKill(game, groupId);
    }
  } else if (data.startsWith("vote_") && game.status === "day") {
    const targetId = parseInt(data.slice(5));
    const target = game.players.find((p) => p.id === targetId && p.alive);
    if (!target) return ctx.answerCallbackQuery("Invalid target.");

    game.dayVotes.set(userId, targetId);
    await ctx.answerCallbackQuery(`Voted for ${getDisplayName(target)}.`);

    await updateDayProgress(game, groupId);

    const aliveCount = game.players.filter((p) => p.alive).length;
    if (game.dayVotes.size === aliveCount) {
      await processDayLynch(game, groupId);
    }
  }
});

m.command("newgame", async (ctx) => {
  if (!["group", "supergroup"].includes(ctx.chat.type))
    return ctx.reply("Use in group.");
  const gid = ctx.chat.id;
  if (games.has(gid)) return ctx.reply("Game already running. /endgame first.");
  games.set(gid, { status: "lobby", players: [] });
  ctx.reply("🃏 Mafia lobby created! /join to play. Min 4 players.");
});

m.command("join", async (ctx) => {
  if (!["group", "supergroup"].includes(ctx.chat.type)) return;
  const gid = ctx.chat.id;
  const game = games.get(gid);
  if (!game || game.status !== "lobby") return ctx.reply("No lobby.");
  if (game.players.some((p) => p.id === ctx.from.id))
    return ctx.reply("Already joined.");
  game.players.push({
    id: ctx.from.id,
    first_name: ctx.from.first_name,
    username: ctx.from.username,
    role: null,
    alive: true,
  });
  ctx.reply(
    `✅ ${getDisplayName(ctx.from)} joined! (${game.players.length} total)`,
  );
});

m.command("players", (ctx) => {
  const game = games.get(ctx.chat.id);
  if (!game) return ctx.reply("No game.");
  let msg = "Players:\n";
  game.players.forEach(
    (p) =>
      (msg += `- ${getDisplayName(p)} (${p.alive ? "alive" : "dead"}) ${p.role ? `(${p.role})` : ""}\n`),
  );
  ctx.reply(msg);
});

m.command("startgame", async (ctx) => {
  const gid = ctx.chat.id;
  const game = games.get(gid);
  if (!game || game.status !== "lobby" || game.players.length < 4)
    return ctx.reply("Need lobby + ≥4 players.");

  const mafiaCount = Math.max(1, Math.floor(game.players.length / 3));
  let roles = Array(mafiaCount)
    .fill("mafia")
    .concat(Array(game.players.length - mafiaCount).fill("villager"));
  roles = shuffle(roles);
  game.players.forEach((p, i) => (p.role = roles[i]));

  await ctx.reply("🎮 Game starting! Roles assigned secretly.");
  await sendRevealButton(gid); // initial reveal button

  await startNight(game, gid);
});

m.command(["start", "help"], (ctx) => {
  ctx.reply("/newgame");
});

const runner = run(bot);
const stopRunner = () => runner.isRunning() && runner.stop();

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else {
    console.error("Unknown error:", e);
  }
});

process.once("SIGINT", stopRunner);
process.once("SIGTERM", stopRunner);
