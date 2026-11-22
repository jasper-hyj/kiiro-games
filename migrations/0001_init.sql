-- Kiiro Games accounts, play-chip ledger and seasons. Chips are play money with no cash value.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE magic (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE throttle (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset INTEGER NOT NULL
);
-- one row per player per season; balance is kept in step with the ledger by the same batch
CREATE TABLE season_accounts (
  season TEXT NOT NULL,
  user_id TEXT NOT NULL,
  balance INTEGER NOT NULL,
  last_floor TEXT,
  PRIMARY KEY (season, user_id)
);
-- every chip movement; reasons start / bonus / floor are grants, everything else is play and counts as profit
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season TEXT NOT NULL,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX ledger_board ON ledger(season, user_id);
-- a settlement can be sent twice and still only counts once
CREATE UNIQUE INDEX ledger_once ON ledger(user_id, reason, ref) WHERE ref IS NOT NULL;

-- finished games: a small summary kept for the season, and a replay log trimmed after 90 days
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  rule TEXT,
  ranked INTEGER NOT NULL DEFAULT 0,
  season TEXT NOT NULL,
  room TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  config TEXT,
  summary TEXT,
  replay TEXT
);
CREATE INDEX matches_ended ON matches(ended_at);
CREATE TABLE match_players (
  match_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  seat INTEGER NOT NULL,
  place INTEGER NOT NULL,
  points INTEGER NOT NULL,
  chips INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, seat)
);
CREATE INDEX match_players_user ON match_players(user_id);
