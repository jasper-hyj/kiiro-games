// Run: npx tsx scripts/accounts/economy-test.ts   (needs `wrangler d1 migrations apply kiiro-games --local` first; stop wrangler dev first)
import { getPlatformProxy } from 'wrangler'
import { ensureAccount, settle, leaderboard, level, seasonBonus, START_CHIPS, FLOOR_CHIPS } from '../../party/economy'
import { chipsFor, recordMatch } from '../../party/matches'
import type { D1 } from '../../party/d1'

let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const { env, dispose } = await getPlatformProxy<{ DB: D1 }>({ persist: { path: '.wrangler/state/v3' } })
const db = env.DB
const tag = Math.random().toString(36).slice(2, 7)
const mk = async (n: string, games = 0) => {
  const id = `t${tag}${n}`
  await db.prepare('INSERT INTO users (id,email,name,created_at,games,banned,last_seen) VALUES (?,?,?,?,?,0,0)').bind(id, id + '@x.test', 'P' + n + tag, Date.now(), games).run()
  return id
}

// 1. everybody starts with the same chips; veterans get a small capped bonus
const a = await mk('a'), b = await mk('b'), c = await mk('c'), vet = await mk('v', 10000)
ok((await ensureAccount(db, a)).balance === START_CHIPS, 'new player starts with 10,000')
ok((await ensureAccount(db, b)).balance === START_CHIPS, 'second new player starts equal')
const v = await ensureAccount(db, vet)
ok(v.balance === START_CHIPS + seasonBonus(10000) && seasonBonus(10000) <= START_CHIPS * 0.1, `veteran bonus capped at 10% (got ${v.balance})`)
ok(level(0) === 0 && level(100) === 10 && level(10000) === 100, 'level curve is sqrt of games')

// 2. zero-sum chips for a ranked game; guests/bots excluded
const players = [
  { seat: 0, name: 'A', userId: a, points: 40000 }, { seat: 1, name: 'B', userId: b, points: 30000 },
  { seat: 2, name: 'Bot', userId: null, points: 20000 }, { seat: 3, name: 'C', userId: c, points: 10000 },
]
const ch = chipsFor(players)
ok(Object.keys(ch).length === 3 && Math.abs(Object.values(ch).reduce((x, y) => x + y, 0)) <= 2, `chips zero-sum among humans ${JSON.stringify(ch)}`)
ok(chipsFor([players[0], players[2]]).hasOwnProperty('0') === false, 'one human + bot moves no chips')

// 3. record + settle once, idempotent
const id = 'm' + tag
const rec = { id, game: 'mahjong', rule: 'taiwan', ranked: true, room: 'r', startedAt: Date.now() - 1000, config: {}, players, history: [], replay: [] }
await recordMatch(db, rec); await recordMatch(db, rec)
const A = await ensureAccount(db, a), C = await ensureAccount(db, c)
ok(A.balance === START_CHIPS + ch[0] && A.profit === ch[0], 'winner gained once (double record ignored)')
ok(C.balance === START_CHIPS + ch[3] && C.games === 1, 'loser lost, games counted')
const n = await db.prepare('SELECT COUNT(*) AS n FROM match_players WHERE match_id=?').bind(id).first<{ n: number }>()
ok(n?.n === 4, 'all four seats saved')

// 4. a player cannot go below zero, and the daily floor tops back up once a day
await settle(db, 'mahjong', 'big' + tag, [{ userId: c, delta: -999999 }])
const broke = await db.prepare('SELECT balance FROM season_accounts WHERE user_id=? AND season=?').bind(c, new Date().toISOString().slice(0, 7)).first<{ balance: number }>()
ok(broke?.balance === 0, 'balance floors at zero')
const back = await ensureAccount(db, c)
ok(back.balance === FLOOR_CHIPS, 'daily floor tops a broke player up to 2,000')
const again = await ensureAccount(db, c)
ok(again.balance === FLOOR_CHIPS, 'floor is not repeated the same day')
ok(back.profit < 0, 'floor top-up does not count as profit')

// 5. new player reaches the board right after one good game
const lb = await leaderboard(db, undefined, a)
ok(lb.some((r) => r.me && r.profit === ch[0]), 'newcomer appears on the leaderboard after one game')
ok(lb.every((r, i) => i === 0 || lb[i - 1].profit >= r.profit), 'leaderboard sorted by profit')

// 6. ledger and balances agree
const drift = await db.prepare(`SELECT COUNT(*) AS n FROM season_accounts a WHERE a.balance != (SELECT SUM(delta) FROM ledger l WHERE l.season=a.season AND l.user_id=a.user_id)`).first<{ n: number }>()
ok(drift?.n === 0, 'no balance/ledger drift')
await dispose()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
