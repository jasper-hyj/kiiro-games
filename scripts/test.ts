import { Game } from '../src/engine/game'
import { kindOf, sortIds } from '../src/engine/tiles'
import { shantenAll, toCounts } from '../src/engine/hand'
import type { RuleId } from '../src/engine/rules'

let fails = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
}

const parse = (s: string): number[] => {
  const ks: number[] = []
  let digits: number[] = []
  for (const ch of s) {
    if (/\d/.test(ch)) digits.push(+ch)
    else { const base = { m: 0, p: 9, s: 18, z: 27 }[ch as 'm']; for (const d of digits) ks.push(base + d - 1); digits = [] }
  }
  return ks
}
const used = new Map<number, number>()
const ids = (ks: number[]) => ks.map((k) => { const n = used.get(k) ?? 0; used.set(k, n + 1); return k * 4 + n })

function setup(rule: RuleId, hand: string, win: string, o: { seat?: number; tsumo?: boolean; riichi?: boolean; melds?: { type: any; tiles: string }[] } = {}) {
  used.clear()
  const g = new Game(rule, { rule, aka: false, rounds: 1, minFan: 3 } as any, ['a', 'b', 'c', 'd'])
  g.dealer = 0; g.roundIndex = 0; g.lian = 0; g.honba = 0
  g.doraPool = [120, 120, 120, 120, 120]; g.uraPool = [120, 120, 120, 120, 120]; g.doraCount = 1
  const seat = o.seat ?? 1
  const p = g.players[seat]
  p.flowers = []
  p.discards = [{ tile: 0, riichi: false, called: false }]
  p.melds = (o.melds ?? []).map((m) => ({ type: m.type, tiles: ids(parse(m.tiles)), from: 0 }))
  p.hand = sortIds(ids(parse(hand)))
  const wid = ids(parse(win))[0]
  p.riichi = !!o.riichi
  const tsumo = o.tsumo ?? true
  if (tsumo) { p.hand.push(wid); p.drawn = wid }
  return { g, seat, wid, tsumo, p }
}
const run = (t: ReturnType<typeof setup>) => {
  const sc = t.g.checkWin(t.seat, t.tsumo, t.tsumo ? undefined : t.wid)
  return sc
}
const pay = (t: ReturnType<typeof setup>) => {
  const sc = run(t)!
  return t.g.rule.settle(sc, { winner: t.seat, from: t.tsumo ? null : 0, dealer: 0, honba: 0, lianZhuang: 0 })
}

// --- Riichi ---
{
  const t = setup('riichi', '23m456m789p234s55p', '1m')
  const sc = run(t)!
  eq('riichi pinfu+tsumo han/fu', [sc.total, sc.fu], [2, 20])
  eq('riichi pinfu tsumo payments (non-dealer)', pay(t), [-700, 1500, -400, -400])
}
{
  const t = setup('riichi', '1122m3344p5566s7z', '7z', { riichi: true })
  const sc = run(t)!
  eq('chiitoi riichi tsumo', [sc.total, sc.fu], [4, 25])
  eq('chiitoi pays', pay(t), [-3200, 6400, -1600, -1600])
}
{
  const t = setup('riichi', '19m19p19s1234567z', '1z', { tsumo: false })
  const sc = run(t)!
  eq('kokushi yakuman', [sc.yakuman, sc.base], [1, 8000])
  eq('kokushi ron non-dealer 32000', pay(t)[0], -32000)
}
{
  const t = setup('riichi', '234m234p234s55m66p', '6p', { tsumo: false })
  const names = run(t)!.yaku.map((y) => y.name)
  eq('sanshoku + tanyao', names.includes('Sanshoku Doujun') && names.includes('Tanyao (All Simples)'), true)
}
{
  const t = setup('riichi', '123m456p789s33z44z', '4z', { tsumo: false })
  eq('no yaku => cannot win', run(t), null)
}
{
  const t = setup('riichi', '123m456p789s5566z', '6z', { tsumo: false })
  eq('yakuhai ron valid (shanpon 5z6z? green dragon)', run(t) !== null, true)
}
{
  // open hand: pon of red dragon + chi, ron. fu: 20 + open red dragon pon 4 = 24 -> 30
  const t = setup('riichi', '234p678s5m', '5m', { tsumo: false, melds: [{ type: 'pon', tiles: '777z' }, { type: 'chi', tiles: '123m' }] })
  const sc = run(t)!
  eq('open yakuhai ron han/fu', [sc.total, sc.fu], [1, 30])
  eq('1han30fu ron non-dealer pays 1000', pay(t)[0], -1000)
}
// --- Shanten ---
eq('shanten tenpai', shantenAll(toCounts(parse('123m456p789s1155z').slice(0, 13)), 0, 4, {}), 0)
eq('shanten complete', shantenAll(toCounts(parse('123m456p789s111z22z')), 0, 4, {}), -1)
eq('shanten chiitoi', shantenAll(toCounts(parse('1122m3344p5566s7z')), 0, 4, { chiitoi: true }), 0)

// --- Hong Kong ---
{
  const t = setup('hk', '111m222p333s44z55z', '5z', { tsumo: false })
  const sc = run(t)!
  eq('hk all triplets ron', sc.total >= 3, true)
}
{
  const t = setup('hk', '123m456m789m11p23p', '1p', { tsumo: true })
  // not a valid hand? 123 456 789 m + 11 p + 23p + 1p -> 4 sets: 123m 456m 789m 123p + pair 1p? tiles 1p x3: 11p + win 1p => 111p? decomp: 123p + 11p
  const sc = run(t)
  eq('hk common hand pure tsumo', sc === null ? null : sc.yaku.map((y) => y.name).includes('Common Hand'), true)
}
// --- Taiwan ---
{
  const t = setup('taiwan', '123m456m789m123p456p4p', '4p', { tsumo: false })
  eq('tw 16 tiles hand complete', run(t) !== null, true)
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed')
process.exit(fails ? 1 : 0)
