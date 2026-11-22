import type { D1 } from './d1'
import { seasonOf, settle } from './economy'

export interface MatchPlayer { seat: number; name: string; userId: string | null; points: number }
export interface MatchRecord {
  id: string; game: string; rule: string; ranked: boolean; room: string
  startedAt: number; config: unknown; players: MatchPlayer[]; history: unknown; replay: unknown
  /** per-seat chip change when the game itself already moved the chips (cash tables); disables the zero-sum settlement */
  chips?: Record<number, number>
}

/** Chips for a ranked game: zero-sum among the signed-in humans, proportional to how far each finished from their average. */
export function chipsFor(players: MatchPlayer[], stake = 1000): Record<number, number> {
  const humans = players.filter((p) => p.userId)
  const out: Record<number, number> = {}
  if (humans.length < 2) return out
  const mean = humans.reduce((a, p) => a + p.points, 0) / humans.length
  const all = players.reduce((a, p) => a + p.points, 0) / players.length || 1
  for (const p of humans) out[p.seat] = Math.round((stake * (p.points - mean)) / Math.abs(all))
  return out
}

/** Save the finished game (idempotent by id) and, for ranked games, settle chips. */
export async function recordMatch(db: D1, m: MatchRecord): Promise<void> {
  const exists = await db.prepare('SELECT 1 AS x FROM matches WHERE id=?').bind(m.id).first()
  if (exists) return
  const ordered = [...m.players].sort((a, b) => b.points - a.points)
  const chips = m.chips ?? (m.ranked ? chipsFor(m.players) : {})
  const stmts = [
    db.prepare('INSERT INTO matches (id,game,rule,ranked,season,room,started_at,ended_at,config,summary,replay) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(m.id, m.game, m.rule, m.ranked ? 1 : 0, seasonOf(), m.room, m.startedAt, Date.now(), JSON.stringify(m.config), JSON.stringify(m.history), JSON.stringify(m.replay)),
    ...m.players.map((p) =>
      db.prepare('INSERT INTO match_players (match_id,user_id,name,seat,place,points,chips) VALUES (?,?,?,?,?,?,?)')
        .bind(m.id, p.userId, p.name, p.seat, ordered.findIndex((o) => o.seat === p.seat) + 1, p.points, chips[p.seat] ?? 0)),
  ]
  await db.batch(stmts)
  if (m.ranked && !m.chips) {
    const results = m.players.filter((p) => p.userId && chips[p.seat] !== undefined).map((p) => ({ userId: p.userId as string, delta: chips[p.seat] }))
    if (results.length) await settle(db, m.game, m.id, results)
  }
}

/** Drop the bulky replay log of old matches; the summary stays. */
export async function trimReplays(db: D1, days = 90): Promise<void> {
  await db.prepare('UPDATE matches SET replay=NULL WHERE replay IS NOT NULL AND ended_at<?').bind(Date.now() - days * 86400e3).run()
}
