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
    chatId: integer("chat_id").notNull().unique(),
  },
  (table) => [index("idx_lobby_games_chat_id").on(table.chatId)],
);

export type LobbyGameData = (typeof lobbyGames)["$inferSelect"];

export const lobbyPlayers = sqliteTable(
  "lobby_players",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "restrict" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => lobbyGames.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.userId] }),
    index("idx_lobby_players_user_id").on(table.userId),
    index("idx_lobby_players_game_id").on(table.gameId),
  ],
);

export type LobbyPlayerData = (typeof lobbyPlayers)["$inferSelect"];

export const liveGames = sqliteTable(
  "live_games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: integer("chat_id").notNull().unique(),
    status: text("status", { enum: ["night", "day"] }).notNull(),
  },
  (table) => [index("idx_live_games_chat_id").on(table.chatId)],
);

export type LiveGameData = (typeof liveGames)["$inferSelect"];

export const livePlayers = sqliteTable(
  "live_players",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "restrict" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => liveGames.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["mafia", "villager"] }).notNull(),
    alive: integer("alive", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.userId] }),
    index("idx_live_players_user_id").on(table.userId),
    index("idx_live_players_game_id").on(table.gameId),
  ],
);

export type LivePlayerData = (typeof livePlayers)["$inferSelect"];

export const liveDayVotes = sqliteTable(
  "live_day_votes",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "restrict" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => liveGames.id, { onDelete: "cascade" }),
    votingForId: integer("voting_for_id")
      .notNull()
      .references(() => users.userId),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.userId] }),
    index("idx_live_day_votes_user_id").on(table.userId),
    index("idx_live_day_votes_game_id").on(table.gameId),
  ],
);

export type LiveDayVoteData = (typeof liveDayVotes)["$inferSelect"];
