import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().unique(),
    firstName: text("first_name").notNull(),
    username: text("username"),
  },
  (table) => [index("idx_users_user_id").on(table.userId)],
);

export type UserData = (typeof users)["$inferSelect"];

export const lobbyGames = sqliteTable(
  "lobby_games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: integer("chat_id").notNull(),
    players: text("players", { mode: "json" })
      .$type<number[]>()
      .notNull()
      .default(sql`(json_array())`),
  },
  (table) => [index("idx_lobby_games_chat_id").on(table.chatId)],
);

export type LobbyGameData = (typeof lobbyGames)["$inferSelect"];

export const players = sqliteTable(
  "players",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => liveGames.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["mafia", "villager"] }).notNull(),
    alive: integer("alive", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    index("idx_players_user_id").on(table.userId),
    index("idx_players_game_id").on(table.gameId),
    primaryKey({ columns: [table.gameId, table.userId] }),
  ],
);

export type PlayerData = (typeof players)["$inferSelect"];

export const liveGames = sqliteTable(
  "live_games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: integer("chat_id").notNull(),
    players: text("players", { mode: "json" })
      .$type<number[]>()
      .notNull()
      .default(sql`(json_array())`),
    status: text("status", { enum: ["night", "day"] }).notNull(),
  },
  (table) => [index("idx_live_games_chat_id").on(table.chatId)],
);

export type LiveGameData = (typeof liveGames)["$inferSelect"];

export const finishedGames = sqliteTable(
  "finished_games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: integer("chat_id").notNull(),
    players: text("players", { mode: "json" })
      .$type<number[]>()
      .notNull()
      .default(sql`(json_array())`),
  },
  (table) => [index("idx_finished_games_chat_id").on(table.chatId)],
);

export type FinishedGameData = (typeof finishedGames)["$inferSelect"];
