import type { D1, D1Stmt } from './d1'

/** Tunables. Everyone starts equal; veterans get a small capped bonus; the floor keeps nobody broke. */
export const START_CHIPS = 10000
export const FLOOR_CHIPS = 3000
/** A player appears on a leaderboard after this many results in it (one lucky hand is not a ranking). */
export const MIN_BOARD_GAMES = 3
/** What one "normal" win is worth in each game, so results can be compared across games on the overall board. */
export const GAME_UNIT: Record<string, number> = {
  mahjong: 1000,
  bigtwo: 500,
  holdem: 5000,
  blackjack: 5000,
  gomoku: 500,
  crazyeights: 100,
  yahtzee: 100,
  liarsdice: 400,
  chess: 500,
  xiangqi: 500,
  doudizhu: 600,
  bridge: 200,
  hearts: 400,
  spades: 400,
  go: 500,
  checkers: 500,
  reversi: 400,
  chinesecheckers: 300,
}
export const BOARD_GAMES = Object.keys(GAME_UNIT)
export const MAX_BONUS_PCT = 0.1
export const GRANTS = ['start', 'bonus', 'floor', 'hold']

export function seasonOf(ms = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 7)
}
const dayOf = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10)

/** Veteran level grows with the square root of games played, so early games count most and it flattens out. */
export function level(games: number): number {
  return Math.floor(Math.sqrt(Math.max(0, games)))
}
export function seasonBonus(games: number): number {
  return Math.min(Math.round(START_CHIPS * MAX_BONUS_PCT), level(games) * 100)
}

export interface Account {
  season: string
  balance: number
  profit: number
  level: number
  games: number
}

function entry(db: D1, season: string, user: string, delta: number, reason: string, ref: string | null): D1Stmt {
  return db.prepare('INSERT OR IGNORE INTO ledger (season,user_id,delta,reason,ref,at) VALUES (?,?,?,?,?,?)').bind(season, user, delta, reason, ref, Date.now())
}

/** Make sure the player has a row for the current season (start chips + veteran bonus) and today's floor top-up. */
export async function ensureAccount(db: D1, userId: string): Promise<Account> {
  const season = seasonOf()
  const user = await db.prepare('SELECT games FROM users WHERE id=?').bind(userId).first<{ games: number }>()
  const games = user?.games ?? 0
  let row = await db
    .prepare('SELECT balance,last_floor FROM season_accounts WHERE season=? AND user_id=?')
    .bind(season, userId)
    .first<{ balance: number; last_floor: string | null }>()
  if (!row) {
    const bonus = seasonBonus(games)
    const stmts = [
      db.prepare('INSERT OR IGNORE INTO season_accounts (season,user_id,balance,last_floor) VALUES (?,?,?,NULL)').bind(season, userId, START_CHIPS + bonus),
      entry(db, season, userId, START_CHIPS, 'start', season),
    ]
    if (bonus > 0) stmts.push(entry(db, season, userId, bonus, 'bonus', season))
    await db.batch(stmts)
    row = { balance: START_CHIPS + bonus, last_floor: null }
  }
  const today = dayOf()
  if (row.balance < FLOOR_CHIPS && row.last_floor !== today) {
    // chips sitting at a table are still yours: the top-up only applies when balance + chips on tables is under the floor
    const h = await db
      .prepare(`SELECT COALESCE(-SUM(delta),0) AS held FROM ledger WHERE season=? AND user_id=? AND reason='hold'`)
      .bind(season, userId)
      .first<{ held: number }>()
    const held = Math.max(0, h?.held ?? 0)
    const top = FLOOR_CHIPS - held - row.balance
    if (top > 0) {
      await db.batch([
        db.prepare('UPDATE season_accounts SET balance=balance+?, last_floor=? WHERE season=? AND user_id=?').bind(top, today, season, userId),
        entry(db, season, userId, top, 'floor', today),
      ])
      row.balance += top
    }
  }
  const p = await db
    .prepare(`SELECT COALESCE(SUM(delta),0) AS p FROM ledger WHERE season=? AND user_id=? AND reason NOT IN ('start','bonus','floor','hold')`)
    .bind(season, userId)
    .first<{ p: number }>()
  return { season, balance: row.balance, profit: p?.p ?? 0, level: level(games), games }
}

export interface Settlement {
  userId: string
  delta: number
}

/**
 * Apply the result of one finished game. `ref` makes it idempotent (the same game never pays twice).
 * A player can never go below zero, and the whole game moves chips only between the players in it,
 * so the leaderboard cannot be inflated by playing alone.
 */
export async function settle(db: D1, game: string, ref: string, results: Settlement[]): Promise<void> {
  const season = seasonOf()
  const reason = `play:${game}`
  // a player cannot lose more than their balance, and what the winners receive is never more than what the losers actually paid
  // (otherwise an empty account could "lose" for free and mint chips for a partner)
  const deltas = new Map<string, number>()
  for (const r of results) {
    const acct = await ensureAccount(db, r.userId)
    deltas.set(r.userId, Math.max(-acct.balance, Math.round(r.delta)))
  }
  const paid = [...deltas.values()].filter((d) => d < 0).reduce((a, d) => a - d, 0)
  const won = [...deltas.values()].filter((d) => d > 0).reduce((a, d) => a + d, 0)
  if (won > paid) for (const [u, d] of deltas) if (d > 0) deltas.set(u, Math.floor((d * paid) / won))
  for (const r of results) {
    const delta = deltas.get(r.userId) ?? 0
    const done = await db.prepare('SELECT 1 AS x FROM ledger WHERE user_id=? AND reason=? AND ref=?').bind(r.userId, reason, ref).first()
    if (done) continue
    await db.batch([
      entry(db, season, r.userId, delta, reason, ref),
      db.prepare('UPDATE season_accounts SET balance=balance+? WHERE season=? AND user_id=?').bind(delta, season, r.userId),
      db.prepare('UPDATE users SET games=games+1 WHERE id=?').bind(r.userId),
    ])
  }
}

export interface Row {
  rank: number
  name: string
  level: number
  profit: number
  games: number
  score?: number
  me?: boolean
}

/**
 * Season boards. `game` = one game's chip profit, or "all" = every game's result measured in that game's own units
 * (so a Mahjong win and a Hold'em win count alike). Nobody appears before MIN_BOARD_GAMES results in that board.
 */
export async function leaderboard(db: D1, season = seasonOf(), me?: string, limit = 50, game = 'all'): Promise<Row[]> {
  const reasons = game === 'all' ? BOARD_GAMES : BOARD_GAMES.includes(game) ? [game] : BOARD_GAMES
  const { results } = await db
    .prepare(
      `SELECT u.id AS id, u.name AS name, u.games AS games, l.reason AS reason, SUM(l.delta) AS profit, COUNT(*) AS n
       FROM ledger l JOIN users u ON u.id=l.user_id
      WHERE l.season=? AND l.reason IN (${reasons.map(() => '?').join(',')}) GROUP BY l.user_id, l.reason`,
    )
    .bind(season, ...reasons.map((g) => 'play:' + g))
    .all<{ id: string; name: string; games: number; reason: string; profit: number; n: number }>()
  const by = new Map<string, { id: string; name: string; games: number; profit: number; score: number; n: number }>()
  for (const r of results) {
    const g = r.reason.slice(5)
    const x = by.get(r.id) ?? { id: r.id, name: r.name, games: r.games, profit: 0, score: 0, n: 0 }
    x.profit += r.profit
    x.score += r.profit / (GAME_UNIT[g] ?? 1000)
    x.n += r.n
    by.set(r.id, x)
  }
  const all = [...by.values()].filter((x) => x.n >= MIN_BOARD_GAMES)
  all.sort((a, b) => (game === 'all' ? b.score - a.score : b.profit - a.profit) || a.games - b.games)
  return all.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    level: level(r.games),
    profit: r.profit,
    score: Math.round(r.score * 10) / 10,
    games: r.n,
    me: r.id === me || undefined,
  }))
}

/**
 * Take chips off the balance to sit at a cash table. They stay on the ledger as a "hold" (not profit)
 * until the player leaves and `release` returns whatever they have left. Returns false when the balance is too low.
 */
export async function hold(db: D1, userId: string, amount: number, ref: string): Promise<boolean> {
  if (!Number.isInteger(amount) || amount <= 0) return false
  const acct = await ensureAccount(db, userId)
  if (acct.balance < amount) return false
  const season = seasonOf()
  const dup = await db.prepare('SELECT 1 AS x FROM ledger WHERE user_id=? AND reason=? AND ref=?').bind(userId, 'hold', ref).first()
  if (dup) return true
  // the balance check is repeated inside the update so two simultaneous buy-ins cannot overdraw
  const res = await db
    .prepare('UPDATE season_accounts SET balance=balance-? WHERE season=? AND user_id=? AND balance>=?')
    .bind(amount, season, userId, amount)
    .run()
  if (!res.meta?.changes) return false
  await entry(db, season, userId, -amount, 'hold', ref).run()
  return true
}

/** Close a cash-table session: the held chips come back, and the difference counts as that session's profit or loss. */
export async function release(db: D1, userId: string, principal: number, stack: number, ref: string, cap?: { game: string; dailyCap: number }): Promise<void> {
  const season = seasonOf()
  const done = await db
    .prepare('SELECT 1 AS x FROM ledger WHERE user_id=? AND reason=? AND ref=?')
    .bind(userId, 'hold', ref + ':r')
    .first()
  if (done) return
  await ensureAccount(db, userId)
  let net = stack - principal
  // against the house (Blackjack) the day's profit is capped: whatever is above the cap is not paid out
  if (cap && net > 0) {
    const dayStart = new Date().setUTCHours(0, 0, 0, 0)
    const row = await db
      .prepare('SELECT COALESCE(SUM(delta),0) AS d FROM ledger WHERE user_id=? AND reason=? AND at>=?')
      .bind(userId, 'play:' + cap.game, dayStart)
      .first<{ d: number }>()
    const room = Math.max(0, cap.dailyCap - (row?.d ?? 0))
    if (net > room) {
      stack = principal + room
      net = room
    }
  }
  const stmts = [
    entry(db, season, userId, principal, 'hold', ref + ':r'),
    db.prepare('UPDATE season_accounts SET balance=balance+? WHERE season=? AND user_id=?').bind(stack, season, userId),
  ]
  if (net !== 0) stmts.push(entry(db, season, userId, net, 'play:' + (cap?.game ?? 'holdem'), ref + ':n'))
  // only a session that actually moved chips counts as a game (sitting down and leaving again must not raise a veteran level)
  if (net !== 0) stmts.push(db.prepare('UPDATE users SET games=games+1 WHERE id=?').bind(userId))
  await db.batch(stmts)
}
