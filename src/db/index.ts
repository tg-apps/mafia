import { Database } from "bun:sqlite";

import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "./schema";

const sqlite = new Database("database.db");

sqlite.run(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id    INTEGER NOT NULL UNIQUE,
    first_name TEXT    NOT NULL,
    username   TEXT
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

  CREATE TABLE IF NOT EXISTS lobby_games (
    id      INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    chat_id INTEGER NOT NULL UNIQUE
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_lobby_games_chat_id ON lobby_games(chat_id);

  CREATE TABLE IF NOT EXISTS lobby_players (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    game_id INTEGER NOT NULL REFERENCES lobby_games(id) ON DELETE CASCADE,

    PRIMARY KEY (game_id, user_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_lobby_players_user_id ON lobby_players(user_id);
  CREATE INDEX IF NOT EXISTS idx_lobby_players_game_id ON lobby_players(game_id);

  CREATE TABLE IF NOT EXISTS live_games (
    id      INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    chat_id INTEGER NOT NULL UNIQUE,
    status  TEXT    NOT NULL CHECK(status IN ('night', 'day'))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_live_games_chat_id ON live_games(chat_id);

  CREATE TABLE IF NOT EXISTS live_players (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    game_id INTEGER NOT NULL REFERENCES live_games(id) ON DELETE CASCADE,
    role    TEXT    NOT NULL CHECK(role IN ('mafia','villager')),
    alive   INTEGER NOT NULL DEFAULT 1 CHECK(alive IN (0,1)),

    PRIMARY KEY (game_id, user_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_live_players_user_id ON live_players(user_id);
  CREATE INDEX IF NOT EXISTS idx_live_players_game_id ON live_players(game_id);

  CREATE TABLE IF NOT EXISTS live_day_votes (
    user_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    game_id        INTEGER NOT NULL REFERENCES live_games(id) ON DELETE CASCADE,
    voting_for_id  INTEGER NOT NULL REFERENCES users(user_id),

    PRIMARY KEY (game_id, user_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_live_day_votes_user_id ON live_day_votes(user_id);
  CREATE INDEX IF NOT EXISTS idx_live_day_votes_game_id ON live_day_votes(game_id);
`);

const db = drizzle(sqlite, { schema });

export { db, schema };
