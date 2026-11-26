import { Game } from '../../src/games/mahjong/engine/game'
import { sortIds } from '../../src/games/mahjong/engine/tiles'

/** "Why can't I win?" — a complete shape that cannot win must be explained, and a real win must never be flagged. */
let fails = 0
const ok = (n: string, c: boolean, extra = '') => {
  if (!c) fails++
  console.log(c ? 'ok  ' : 'FAIL', n, c ? '' : extra)
}
const parse = (s: string): number[] => {
  const ks: number[] = []
  let digits: number[] = []
  for (const ch of s) {
    if (/\d/.test(ch)) digits.push(+ch)
    else {
      const base = { m: 0, p: 9, s: 18, z: 27 }[ch as 'm']
      for (const d of digits) ks.push(base + d - 1)
      digits = []
    }
  }
  return ks
}
const used = new Map<number, number>()
const ids = (ks: number[]) =>
  ks.map((k) => {
    const n = used.get(k) ?? 0
    used.set(k, n + 1)
    return k * 4 + n
  })
function make(
  rule: 'riichi' | 'hk' | 'mcr' | 'sichuan' | 'taiwan',
  hand: string,
  win: string,
  o: { tsumo?: boolean; voidSuit?: number; discarded?: string; melds?: { type: 'chi' | 'pon'; tiles: string }[] } = {},
) {
  used.clear()
  const g = new Game(rule, { rule, aka: false, rounds: 1, minFan: rule === 'mcr' ? 8 : rule === 'hk' ? 3 : 0, swap: false, fixedDealer: true } as never, [
    'a',
    'b',
    'c',
    'd',
  ])
  g.dealer = 0
  g.roundIndex = 0
  g.doraPool = [64, 64, 64, 64, 64]
  g.uraPool = [64, 64, 64, 64, 64]
  const p = g.players[1]
  p.discards = (o.discarded ? parse(o.discarded) : [0]).map((k) => ({ tile: k * 4 + 3, riichi: false, called: false }))
  p.melds = (o.melds ?? []).map((m) => ({ type: m.type, tiles: ids(parse(m.tiles)), from: 0 }))
  p.hand = sortIds(ids(parse(hand)))
  p.voidSuit = o.voidSuit ?? 2
  const wid = ids(parse(win))[0]
  if (o.tsumo) {
    p.hand.push(wid)
    p.drawn = wid
  }
  return { g, wid, tsumo: !!o.tsumo }
}
{
  // riichi: closed shape, no yaku (open hand with only simple sets and a terminal)
  const { g, wid } = make('riichi', '123m456p789s55p3m', '1m'.replace('1m', '2m'), { melds: [] })
  void g
  void wid
}
{
  const { g, wid } = make('riichi', '234m567p789s23p55m', '4p') // closed ron with no yaku? (it has pinfu) -> should NOT be flagged
  ok('a real win is never explained away', g.explainNoWin(1, false, wid) === null)
}
{
  const { g, wid } = make('riichi', '123p456s789s11z23m', '4m', { discarded: '9p', melds: [{ type: 'chi', tiles: '234p' }] })
  // hand: 123p 456s 789s 11z 23m + chi 234p = complete with 4m, but open and no yaku (11z is East = round wind -> yakuhai only for the pair, no)
  const w = g.explainNoWin(1, false, wid)
  ok('riichi: open hand without a yaku is explained as "no yaku"', !!w && w.code === 'noYaku', JSON.stringify(w))
}
{
  const { g, wid } = make('hk', '234m456p23m55p', '4m', { melds: [{ type: 'chi', tiles: '789s' }] })
  const w = g.explainNoWin(1, false, wid)
  ok('hong kong: 3 fan minimum is explained with the real fan count', !!w && w.code === 'minFan' && w.n !== undefined && w.need === 3, JSON.stringify(w))
}
{
  const { g, wid } = make('mcr', '234m456p23m55p', '4m', { melds: [{ type: 'chi', tiles: '789s' }] })
  const w = g.explainNoWin(1, false, wid)
  ok('mcr: below 8 fan is explained', !!w && w.code === 'minFan' && w.need === 8, JSON.stringify(w))
}
{
  const { g, wid } = make('sichuan', '123m456m789m12p33s', '3p')
  // holds a bamboo tile (void suit) -> the shape 123m456m789m 12p+3p +33s? not complete; use a complete shape with a void tile
  void g
  void wid
}
{
  const { g, wid } = make('sichuan', '123m456m789m23p55s', '1p')
  const w = g.explainNoWin(1, false, wid)
  ok('sichuan: a complete hand that still holds the given-up suit is explained', !!w && w.code === 'void', JSON.stringify(w))
}
{
  const { g, wid } = make('riichi', '234m567p789s23p55m', '4p', { discarded: '1p' })
  const w = g.explainNoWin(1, false, wid)
  ok('riichi: furiten (own discard on the wait) is explained', !!w && w.code === 'furiten', JSON.stringify(w))
  const t = make('riichi', '234m567p789s23p55m', '4p', { discarded: '1p', tsumo: true })
  ok('riichi: self-draw is still allowed while furiten', t.g.explainNoWin(1, true) === null)
}
{
  const { g, wid } = make('riichi', '234m567p789s23p55m', '7p') // not a winning tile at all
  ok('a tile that does not complete the shape is not explained', g.explainNoWin(1, false, wid) === null)
}
console.log(fails ? `\n${fails} FAILED` : '\nwhy-not explanations ok')
process.exit(fails ? 1 : 0)
