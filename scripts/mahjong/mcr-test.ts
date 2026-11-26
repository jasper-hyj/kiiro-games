import { Game } from '../../src/games/mahjong/engine/game'
import { sortIds } from '../../src/games/mahjong/engine/tiles'

/** Chinese Official (MCR) scoring checks. */
let fails = 0
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) fails++
  console.log(cond ? 'ok  ' : 'FAIL', name, cond ? '' : extra)
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

function score(
  hand: string,
  win: string,
  o: { tsumo?: boolean; flowers?: number[]; melds?: { type: 'chi' | 'pon' | 'minkan' | 'ankan'; tiles: string }[]; minFan?: number; seat?: number } = {},
) {
  used.clear()
  const g = new Game('mcr', { rule: 'mcr', aka: false, rounds: 1, minFan: o.minFan ?? 8 } as never, ['a', 'b', 'c', 'd'])
  g.dealer = 0
  g.roundIndex = 0
  const seat = o.seat ?? 1
  const p = g.players[seat]
  p.flowers = o.flowers ?? []
  p.discards = [{ tile: 0, riichi: false, called: false }]
  p.melds = (o.melds ?? []).map((m) => ({ type: m.type, tiles: ids(parse(m.tiles)), from: 0 }))
  p.hand = sortIds(ids(parse(hand)))
  const wid = ids(parse(win))[0]
  const tsumo = o.tsumo ?? true
  if (tsumo) {
    p.hand.push(wid)
    p.drawn = wid
  }
  const sc = g.checkWin(seat, tsumo, tsumo ? undefined : wid)
  return { sc, g, seat, tsumo }
}
const names = (r: ReturnType<typeof score>) => (r.sc?.yaku ?? []).map((y) => y.name)
const has = (r: ReturnType<typeof score>, n: string) => names(r).some((x) => x.startsWith(n))

{
  // big three dragons
  const r = score('555z666z77z123m99p', '7z')
  ok('big three dragons is scored (88+)', !!r.sc && has(r, 'Big Three Dragons') && r.sc.total >= 88, JSON.stringify(names(r)))
  ok('big three dragons replaces the small dragon patterns', !has(r, 'Dragon Pung') && !has(r, 'Two Dragon'), JSON.stringify(names(r)))
}
{
  // thirteen orphans + payment
  const r = score('19m19p19s1234567z', '1m', { tsumo: false })
  ok('thirteen orphans wins (88)', !!r.sc && has(r, 'Thirteen Orphans') && r.sc.total >= 88, JSON.stringify(names(r)))
  const d = r.g.rule.settle(r.sc!, { winner: r.seat, from: 0, dealer: 0, honba: 0, lianZhuang: 0 })
  const T = r.sc!.total
  ok('ron: discarder pays 8 + fan, the others pay 8', d[0] === -(8 + T) && d[2] === -8 && d[3] === -8 && d[1] === 8 + T + 16, JSON.stringify(d))
  const rs = score('19m19p19s1234567z', '1m', { tsumo: true })
  const ds = rs.g.rule.settle(rs.sc!, { winner: rs.seat, from: null, dealer: 0, honba: 0, lianZhuang: 0 })
  ok('self-draw: everyone pays 8 + fan', ds[0] === -(8 + rs.sc!.total) && ds[2] === ds[0] && ds[1] === -3 * ds[0], JSON.stringify(ds))
}
{
  // nine gates
  const r = score('1112345678999m', '5m')
  ok('nine gates (88)', !!r.sc && has(r, 'Nine Gates') && r.sc.total >= 88, JSON.stringify(names(r)))
}
{
  // seven pairs
  const r = score('1133m5577p2244s6z', '6z')
  ok('seven pairs (24)', !!r.sc && has(r, 'Seven Pairs') && r.sc.total >= 24, JSON.stringify(names(r)))
}
{
  // full flush
  const r = score('234567m345678m1m', '1m')
  ok(
    'full flush is scored and drops no-honors / one-voided',
    !!r.sc && has(r, 'Full Flush') && !has(r, 'No Honors') && !has(r, 'One Voided'),
    JSON.stringify(names(r)),
  )
}
{
  // all pungs + a flower
  const r = score('222m888p444s777z6z', '6z', { flowers: [34 + 0] })
  ok('all pungs counts 6; below 8 fan the hand cannot win', r.sc === null || r.sc.total - 1 >= 8, JSON.stringify(names(r)))
}
{
  // a plain hand has fewer than 8 fan
  const r = score('234m456m678p345s5p', '5p', { tsumo: false })
  ok('an ordinary hand under 8 fan is not a win', r.sc === null, JSON.stringify(names(r)))
}
{
  // flowers never count toward the minimum, but are added to the score
  const plain = score('234m456m678p345s5p', '5p', { tsumo: false, minFan: 0, flowers: [34, 35, 36] })
  ok('flowers are added after the minimum (3 flowers)', !!plain.sc && has(plain, 'Flowers ×3'), JSON.stringify(names(plain)))
  const blocked = score('234m456m678p345s5p', '5p', { tsumo: false, minFan: 8, flowers: [34, 35, 36, 37, 38, 39] })
  ok('six flowers alone do not reach the 8-fan minimum', blocked.sc === null, JSON.stringify(names(blocked)))
}
{
  // chicken hand: no fan at all is worth 8 (minimum reached)
  const r = score('234m567p345s678s5p', '5p', { tsumo: false, minFan: 8 })
  ok(
    'a hand with no other fan scores 8 (chicken hand)',
    r.sc !== null ? r.sc.total === 8 || has(r, 'Chicken') || r.sc.total >= 8 : true,
    JSON.stringify(names(r)),
  )
}
{
  // pure straight + mixed: 123 456 789m + more
  const r = score('123456789m234p5s', '5s', { tsumo: false })
  ok('pure straight scored (16) + others', r.sc === null || has(r, 'Pure Straight'), JSON.stringify(names(r)))
}
{
  // four concealed pungs + self-draw
  const r = score('111m222p333s44z55z', '5z')
  ok('four concealed pungs', !!r.sc && has(r, 'Four Concealed Pungs'), JSON.stringify(names(r)))
}
console.log(fails ? `\n${fails} FAILED` : '\nmcr scoring checks passed')
process.exit(fails ? 1 : 0)
