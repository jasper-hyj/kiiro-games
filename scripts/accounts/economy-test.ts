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
ok(back.balance === FLOOR_CHIPS, 'daily floor tops a broke player up to the floor')
const again = await ensureAccount(db, c)
ok(again.balance === FLOOR_CHIPS, 'floor is not repeated the same day')
ok(back.profit < 0, 'floor top-up does not count as profit')

// 5. new player reaches the board right after one good game
const lb = await leaderboard(db, undefined, a)
ok(!lb.some((r) => r.me), 'one game is not enough to be ranked')
await settle(db, 'mahjong', 'x1' + tag, [{ userId: a, delta: 300 }, { userId: b, delta: -300 }])
await settle(db, 'mahjong', 'x2' + tag, [{ userId: a, delta: 200 }, { userId: b, delta: -200 }])
const lb2 = await leaderboard(db, undefined, a)
ok(lb2.some((r) => r.me && r.profit === ch[0] + 500), 'after three results a player appears on the board')
const lbm = await leaderboard(db, undefined, a, 50, 'mahjong')
ok(lbm.every((r, i) => i === 0 || lbm[i - 1].profit >= r.profit), 'a game board is sorted by chip profit')
ok(lb2.every((r, i) => i === 0 || (lb2[i - 1].score ?? 0) >= (r.score ?? 0)), 'the overall board is sorted by normalised score')

// 5a. chips cannot be minted: a player with nothing to lose pays nothing, so the winner gains nothing
{
  const { hold } = await import('../../party/economy')
  const x = await mk('mx'), y = await mk('my')
  await ensureAccount(db, x); await ensureAccount(db, y)
  await hold(db, y, START_CHIPS, `t${tag}:y:b0`) // all of y's chips are at a table: the balance is empty
  await settle(db, 'bigtwo', 'mint' + tag, [{ userId: x, delta: 1000 }, { userId: y, delta: -1000 }])
  ok((await ensureAccount(db, x)).balance === START_CHIPS, 'a winner is not paid chips that the loser could not pay')
  // partial: y has 400 left, owes 1000 to x -> x gets exactly 400
  const y2 = await mk('my2'), x2 = await mk('mx2')
  await ensureAccount(db, y2); await ensureAccount(db, x2)
  await hold(db, y2, START_CHIPS - 400, `t${tag}:y2:b0`)
  await settle(db, 'bigtwo', 'mint2' + tag, [{ userId: x2, delta: 1000 }, { userId: y2, delta: -1000 }])
  ok((await ensureAccount(db, x2)).balance === START_CHIPS + 400, 'the winner receives what the loser really paid')
  // the daily top-up looks at chips on tables too: nothing free for someone who just bought in with everything
  const z = await mk('mz')
  await ensureAccount(db, z); await hold(db, z, START_CHIPS - 100, `t${tag}:z:b0`)
  ok((await ensureAccount(db, z)).balance === 100, 'no top-up while your chips are at a table')
}

// 5b. cash-table hold / release, and the daily cap against the house
{
  const { hold, release } = await import('../../party/economy')
  const u = await mk('h')
  await ensureAccount(db, u)
  ok(await hold(db, u, 2000, `t${tag}:1:b0`), 'buy-in holds 2000 chips')
  ok((await ensureAccount(db, u)).balance === START_CHIPS - 2000, 'balance drops by the buy-in')
  ok(!(await hold(db, u, 99999, `t${tag}:2:b0`)), 'a buy-in above the balance is refused')
  ok(await hold(db, u, 2000, `t${tag}:1:b0`) && (await ensureAccount(db, u)).balance === START_CHIPS - 2000, 'the same buy-in reference is not charged twice')
  await release(db, u, 2000, 2600, `t${tag}:1`); await release(db, u, 2000, 2600, `t${tag}:1`)
  const r1 = await ensureAccount(db, u)
  ok(r1.balance === START_CHIPS + 600 && r1.profit === 600, 'cash-out returns the stack once; the difference is profit')
  // blackjack: profit above the daily cap is not paid
  const v = await mk('v2')
  await ensureAccount(db, v)
  await hold(db, v, 2000, `b${tag}:1:b0`)
  await release(db, v, 2000, 2000 + 30000, `b${tag}:1`, { game: 'blackjack', dailyCap: 20000 })
  const r2 = await ensureAccount(db, v)
  ok(r2.balance === START_CHIPS + 20000 && r2.profit === 20000, `blackjack profit is capped at 20,000 a day (got ${r2.profit})`)
  await hold(db, v, 2000, `b${tag}:2:b0`)
  await release(db, v, 2000, 2000 + 5000, `b${tag}:2`, { game: 'blackjack', dailyCap: 20000 })
  ok((await ensureAccount(db, v)).profit === 20000, 'once the cap is reached, further blackjack wins pay nothing')
  await hold(db, v, 2000, `b${tag}:3:b0`)
  await release(db, v, 2000, 500, `b${tag}:3`, { game: 'blackjack', dailyCap: 20000 })
  ok((await ensureAccount(db, v)).profit === 20000 - 1500, 'losses are never capped')
}

// 6. ledger and balances agree
const drift = await db.prepare(`SELECT COUNT(*) AS n FROM season_accounts a WHERE a.balance != (SELECT SUM(delta) FROM ledger l WHERE l.season=a.season AND l.user_id=a.user_id)`).first<{ n: number }>()
ok(drift?.n === 0, 'no balance/ledger drift')
await dispose()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
