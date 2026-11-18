import { Game } from '../src/engine/game'
import { sortIds, kindOf } from '../src/engine/tiles'
import { auditGame } from '../src/engine/audit'

/** One discard that seat 1 may chi and seat 2 (or 3) may pon: every order of decisions must give exactly one legal meld. */
let fails = 0
const ok = (n: string, c: boolean, extra = '') => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', n, c ? '' : extra) }
const k = (kind: number, n: number) => kind * 4 + n

function setup(rule: 'taiwan' | 'hk' | 'riichi' = 'taiwan') {
  const g = new Game(rule, { rule, aka: false, rounds: 1, minFan: 0, swap: false, fixedDealer: true } as never, ['a', 'b', 'c', 'd'])
  g.dealer = 0; g.roundIndex = 0
  // seat 0 discards the 2m (kind 1); seat 1 can chi with 1m+3m or 3m+4m; seat 2 and 3 can pon with two 2m... (only 4 copies exist: 1 discard, 2 for seat 2, 1 spare)
  const filler = [k(20, 0), k(21, 0), k(22, 0), k(23, 0), k(24, 0), k(25, 0), k(26, 0), k(27, 0), k(28, 0), k(29, 0), k(30, 0), k(31, 0), k(32, 0)]
  g.players[0].hand = sortIds([k(1, 0), ...filler.map((x) => x + 1)])
  g.players[0].drawn = k(1, 0)
  g.players[1].hand = sortIds([k(0, 0), k(2, 0), k(3, 0), ...filler.slice(0, 10).map((x) => x + 2)])
  g.players[2].hand = sortIds([k(1, 1), k(1, 2), ...filler.slice(0, 11).map((x) => x + 3)])
  g.players[3].hand = sortIds([k(1, 3), k(5, 0), k(6, 0), ...filler.slice(0, 10).map((x) => x + 0).map((x) => x + 3)])
  for (const p of g.players) { p.discards = []; p.melds = [] }
  g.phase = 'turn'; g.turn = 0
  return g
}

for (const order of [[1, 2], [2, 1], [1, 3], [3, 1]]) {
  const g = setup()
  const turn = g.act(0, { type: 'discard', tile: k(1, 0) })
  ok(`order ${order}: discard accepted`, turn !== false)
  if (g.phase !== 'reaction') { ok(`order ${order}: reaction phase`, false, g.phase); continue }
  const r1 = g.reactions[1], r2 = g.reactions[2], r3 = g.reactions[3]
  ok(`order ${order}: seat 1 may chi`, !!r1 && r1.chi.length > 0, JSON.stringify(r1))
  ok(`order ${order}: seat 2 may pon`, !!r2 && r2.pon)
  void r3
  const decide = (s: number) => { if (g.phase !== 'reaction') return; if (s === 1) g.submitDecision(1, { type: 'chi', use: g.reactions[1].chi[0] }); else if (g.reactions[s]?.pon) g.submitDecision(s, { type: 'pon' }); else if (g.reactions[s]) g.submitDecision(s, { type: 'pass' }) }
  for (const s of order) decide(s)
  for (const s of [1, 2, 3]) if (g.phase === 'reaction' && g.reactions[s] && !g.decisions[s]) g.submitDecision(s, { type: 'pass' })
  const melds = g.players.flatMap((p) => p.melds.map((m) => ({ seat: p.seat, type: m.type, ks: m.tiles.map(kindOf) })))
  ok(`order ${order}: exactly one meld (${JSON.stringify(melds)})`, melds.length === 1)
  ok(`order ${order}: the pon beats the chi`, melds.length === 1 && melds[0].type === 'pon' && melds[0].ks.every((x) => x === 1))
  const a = auditGame(g)
  ok(`order ${order}: audit clean`, a.length === 0, a.join('|'))
}
console.log(fails ? `\n${fails} FAILED` : '\nchi/pon race ok')
process.exit(fails ? 1 : 0)
