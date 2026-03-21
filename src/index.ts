import { run } from "@grammyjs/runner";
import { Bot, GrammyError } from "grammy";

import { upsertUser } from "#utils/user";

import { handleCallback } from "./handlers/callback";
import { handleJoin } from "./handlers/join";
import { handleNewGame } from "./handlers/newgame";
import { handleStartGame } from "./handlers/startgame";

const TOKEN = process.env["TOKEN"];
if (!TOKEN) throw new Error("Missing TOKEN env variable");

const bot = new Bot(TOKEN);

const m = bot.on("message");

bot.on("callback_query", handleCallback);

m.command("newgame", handleNewGame);

m.command("join", handleJoin);

m.command("startgame", handleStartGame);

m.command(["start", "help"], (ctx) => {
  upsertUser(ctx.from);
  return ctx.reply("/newgame");
});

void bot.api.setMyCommands([
  { command: "start", description: "Помощь" },
  { command: "help", description: "Помощь" },
  { command: "newgame", description: "Создать игру в мафию" },
  { command: "join", description: "Присоединиться к игре в мафию" },
  { command: "startgame", description: "Запустить игру в мафию" },
]);

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
