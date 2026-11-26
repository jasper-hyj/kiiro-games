import { Game } from '../../src/games/mahjong/engine/game'
import { sortIds } from '../../src/games/mahjong/engine/tiles'
import { EXAMPLES } from '../../src/games/mahjong/ui/examples'

/** Every worked example in the rules reference must really win in the engine with exactly the stated total. */
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
let fails = 0
for (const ex of EXAMPLES) {
  used.clear()
  const g = new Game(
    ex.rule,
    { rule: ex.rule, aka: false, rounds: 1, minFan: ex.minFan ?? (ex.rule === 'mcr' ? 8 : ex.rule === 'hk' ? 3 : 0), swap: false, fixedDealer: true } as never,
    ['a', 'b', 'c', 'd'],
  )
  g.dealer = 0
  g.roundIndex = 0
  g.doraPool = [64, 64, 64, 64, 64]
  g.uraPool = [64, 64, 64, 64, 64]
  g.doraCount = 1
  const seat = ex.seat ?? 1
  const p = g.players[seat]
  p.flowers = (ex.flowers ?? []).map((k) => 136 + k - 34) // example flowers are given as kinds (34 plum … 41 winter)
  p.discards = [{ tile: 0, riichi: false, called: false }]
  p.melds = (ex.melds ?? []).map((m) => ({ type: m.type, tiles: ids(parse(m.tiles)), from: 0 }))
  p.hand = sortIds(ids(parse(ex.hand)))
  p.riichi = !!ex.riichi
  p.voidSuit = ex.voidSuit ?? 2
  const wid = ids(parse(ex.win))[0]
  if (ex.tsumo) {
    p.hand.push(wid)
    p.drawn = wid
  }
  const sc = g.checkWin(seat, !!ex.tsumo, ex.tsumo ? undefined : wid)
  const handSize = g.rule.handSize - 3 * (ex.melds?.length ?? 0)
  const tilesOk = parse(ex.hand).length === handSize
  const got = sc ? (ex.yakuman ? sc.yakuman : sc.total) : null
  const want = ex.yakuman ?? ex.total
  const ok = tilesOk && got === want
  if (!ok) fails++
  console.log(
    ok ? 'ok  ' : 'FAIL',
    `${ex.rule}/${ex.name[0]}`,
    ok
      ? `(${got})`
      : `got ${got} want ${want}${tilesOk ? '' : ` — hand has ${parse(ex.hand).length} tiles, expected ${handSize}`}${sc ? ' ' + sc.yaku.map((y) => y.name + ' ' + y.value).join(', ') : ''}`,
  )
}
console.log(fails ? `\n${fails} FAILED` : `\nall ${EXAMPLES.length} rulebook examples score exactly as written`)
process.exit(fails ? 1 : 0)
