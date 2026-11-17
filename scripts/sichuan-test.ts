import { Game } from '../src/engine/game'
import { botReact, botSwap, botTurn, botVoid } from '../src/engine/bot'
import { kindOf, sortIds, suitOf } from '../src/engine/tiles'

/** Sichuan (Blood Battle): scoring examples + bot-played games with invariant checks. */
let fails = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) fails++; console.log(cond ? 'ok  ' : 'FAIL', name, cond ? '' : extra) }

// ---------- scoring ----------
const parse = (s: string): number[] => {
  const ks: number[] = []; let digits: number[] = []
  for (const ch of s) {
    if (/\d/.test(ch)) digits.push(+ch)
    else { const base = { m: 0, p: 9, s: 18 }[ch as 'm']; for (const d of digits) ks.push(base + d - 1); digits = [] }
  }
  return ks
}
const used = new Map<number, number>()
const ids = (ks: number[]) => ks.map((k) => { const n = used.get(k) ?? 0; used.set(k, n + 1); return k * 4 + n })
function score(hand: string, win: string, o: { tsumo?: boolean; voidSuit?: number; melds?: { type: 'pon' | 'minkan' | 'ankan'; tiles: string }[] } = {}) {
  used.clear()
  const g = new Game('sichuan', { rule: 'sichuan', aka: false, rounds: 1, minFan: 0, swap: false } as never, ['a', 'b', 'c', 'd'])
  const seat = 1
  const p = g.players[seat]
  p.voidSuit = o.voidSuit ?? 2
  p.discards = [{ tile: 0, riichi: false, called: false }] // not a first-turn win
  p.melds = (o.melds ?? []).map((m) => ({ type: m.type, tiles: ids(parse(m.tiles)), from: 0 }))
  p.hand = sortIds(ids(parse(hand)))
  const wid = ids(parse(win))[0]
  const tsumo = o.tsumo ?? false
  if (tsumo) { p.hand.push(wid); p.drawn = wid }
  return g.checkWin(seat, tsumo, tsumo ? undefined : wid)
}
{
  const s = score('123m456m789m12p33p', '3p')       // plain: 0 fan => 1 point
  ok('plain hand is worth 1 point (2^0)', !!s && s.total === 0 && s.base === 1, JSON.stringify(s))
  const t = score('123m456m789m12p33p', '3p', { tsumo: true })
  ok('self-draw adds a fan (2 points)', !!t && t.total === 1 && t.base === 2, JSON.stringify(t))
  const f = score('1112345678999m', '5m')            // pure suit (void = sou)
  ok('pure suit scores and is capped at 4 fan (16 points)', !!f && f.total >= 2 && f.base <= 16, JSON.stringify(f))
  const v = score('123m456m789m12p33p', '3p', { voidSuit: 1 })
  ok('a hand holding the given-up suit cannot win', v === null)
  const pairs = score('1133m5577p1199m', '2p', { voidSuit: 2 })
  ok('a hand with a seven-pairs shape needs 7 pairs (not here)', pairs === null || pairs.yaku.some((y) => y.name === 'Seven Pairs'))
  const sp = score('1122m3344m5566m7m', '7m', { voidSuit: 2 })
  ok('seven pairs: 2 fan + pure suit 2 = 4 fan', !!sp && sp.yaku.some((y) => y.name === 'Seven Pairs') && sp.total >= 4, JSON.stringify(sp))
  const ap = score('222m555p9p', '9p', { voidSuit: 2, melds: [{ type: 'pon', tiles: '888m' }, { type: 'pon', tiles: '444p' }] })
  ok('all pungs is 1 fan', !!ap && ap.yaku.some((y) => y.name === 'All Pungs'), JSON.stringify(ap))
  const root = score('1111m23m456p789p9p', '9p', { voidSuit: 2 })
  ok('four of a kind in the hand is a root (+1 fan)', !!root && root.yaku.some((y) => y.name.startsWith('Root')), JSON.stringify(root))
}

// ---------- full games with bots ----------
type Lv = 'easy' | 'normal' | 'hard'
function playGame(n: number, swap: boolean, level: Lv): string[] {
  const errs: string[] = []
  const g = new Game('sichuan', { rule: 'sichuan', aka: false, rounds: 1, minFan: 0, swap } as never, ['A', 'B', 'C', 'D'])
  let guard = 0
  while ((g.phase as string) !== 'over' && guard++ < 40000) {
    const ph = g.phase as string
    if (ph === 'swap') { for (const p of g.players) if (!p.swapTiles && !g.submitSwap(p.seat, botSwap(g, p.seat))) errs.push('bot swap rejected') }
    else if (ph === 'void') { for (const p of g.players) if (p.voidSuit === null && !g.submitVoid(p.seat, botVoid(g, p.seat))) errs.push('bot void rejected') }
    else if (ph === 'turn') {
      const s = g.turn
      if (g.players[s].out) { errs.push('an out player was given a turn'); break }
      const a = botTurn(g, s, level)
      if (!g.act(s, a)) { const o = g.turnOptions(s); if (!o.discard.length || !g.act(s, { type: 'discard', tile: o.discard[0] })) { errs.push('turn stuck'); break } }
      for (const p of g.players) {
        const vs = p.voidSuit
        if (p.out && p.hand.some((i) => suitOf(kindOf(i)) === vs)) errs.push('winner holds the void suit')
      }
    } else if (ph === 'reaction') {
      for (const s of g.pendingSeats()) if ((g.phase as string) === 'reaction') {
        if (!g.submitDecision(s, botReact(g, s, level))) g.submitDecision(s, { type: 'pass' })
      }
    } else if (ph === 'result') {
      const r = g.result!
      const wins = r.sc?.wins ?? []
      if (wins.length > 3) errs.push('more than three winners')
      if (r.deltas.reduce((a, b) => a + b, 0) !== 0) errs.push(`hand deltas do not sum to zero: ${r.deltas.join(',')}`)
      if (new Set(wins.map((w) => w.winner)).size !== wins.length) errs.push('a player won twice')
      for (const w of wins) {
        const pl = g.players[w.winner]
        if (pl.hand.some((i) => suitOf(kindOf(i)) === pl.voidSuit)) errs.push('win with the void suit')
        if (w.points < 1 || w.points > 2 ** 4) errs.push(`win points out of range ${w.points}`)
      }
      if (g.players.reduce((a, p) => a + p.points, 0) !== 0) errs.push('points not conserved')
      g.next()
    }
  }
  if (guard >= 40000) errs.push('game did not finish')
  if ((g.phase as string) !== 'over') errs.push('not over')
  void n
  return errs
}
const N = Number(process.argv[2] ?? 60)
let games = 0, bad = 0
for (let i = 0; i < N; i++) {
  const errs = playGame(i, i % 3 !== 0, (['easy', 'normal', 'hard'] as Lv[])[i % 3])
  games++
  if (errs.length) { bad++; console.log('FAIL game', i, [...new Set(errs)].slice(0, 4).join(' | ')) }
}
ok(`${games} bot games finished with all invariants intact`, bad === 0, `${bad} bad games`)
console.log(fails ? `\n${fails} FAILED` : '\nsichuan checks passed')
process.exit(fails ? 1 : 0)
