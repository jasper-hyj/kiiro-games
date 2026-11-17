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

function setup(rule: RuleId, hand: string, win: string, o: { lian?: number; flowers?: number[]; seat?: number; tsumo?: boolean; riichi?: boolean; melds?: { type: any; tiles: string }[] } = {}) {
  used.clear()
  const g = new Game(rule, { rule, aka: false, rounds: 1, minFan: 3 } as any, ['a', 'b', 'c', 'd'])
  g.dealer = 0; g.roundIndex = 0; g.lian = o.lian ?? 0; g.honba = 0
  g.doraPool = [120, 120, 120, 120, 120]; g.uraPool = [120, 120, 120, 120, 120]; g.doraCount = 1
  const seat = o.seat ?? 1
  const p = g.players[seat]
  p.flowers = o.flowers ?? []
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

// --- Dora (Riichi) ---
import { doraFrom } from '../src/engine/tiles'
eq('dora: 9m indicator -> 1m', doraFrom(8), 0)
eq('dora: 5p -> 6p', doraFrom(13), 14)
eq('dora: North -> East', doraFrom(30), 27)
eq('dora: Red dragon -> White', doraFrom(33), 31)
eq('dora (sanma): 1m indicator -> 9m, 9m -> 1m', [doraFrom(0, true), doraFrom(8, true)], [8, 0])
{
  // closed hand 234m 456p 678s 33z + 11m(pair?) -> use a simple tanyao-free valid hand with 2 dora
  const t = setup('riichi', '123m456p789s5566z', '6z', { tsumo: false, riichi: true })
  t.g.doraPool = [parse('4s')[0] * 4]            // indicator 4s -> dora 5s ... hand has none
  eq('no dora in hand -> no dora entry', run(t)!.yaku.some((y) => y.name === 'Dora'), false)
  t.g.doraPool = [parse('9m')[0] * 4]            // 9m -> 1m : hand holds one 1m
  eq('one dora tile in hand counted', run(t)!.yaku.find((y) => y.name === 'Dora')?.value, 1)
  t.g.doraPool = [parse('4z')[0] * 4]            // North -> East: none
  t.g.uraPool = [parse('9m')[0] * 4]             // ura indicator 9m -> 1m, riichi hand -> +1 ura
  t.p.riichi = true
  eq('ura dora counts only with riichi', run(t)!.yaku.find((y) => y.name === 'Ura Dora')?.value, 1)
  t.p.riichi = false
  eq('no ura dora without riichi', run(t)!.yaku?.some((y) => y.name === 'Ura Dora') ?? false, false)
}


// --- Riichi match ending ---
{
  const mk = (rounds: 1 | 2, players = 4) => new Game('riichi', { rule: 'riichi', aka: true, rounds, minFan: 0 } as any, ['a', 'b', 'c', 'd'].slice(0, players))
  const finishDraw = (g: Game, dealerStays: boolean) => (g as any).finish({ kind: 'draw', deltas: new Array(g.n).fill(0), tenpai: [], hands: [], dealerBefore: g.dealer }, dealerStays, true)
  const finishWin = (g: Game, winner: number, dealerStays: boolean) => (g as any).finish({ kind: 'win', winner, from: null, tsumo: true, score: { yaku: [], total: 1, base: 1000 }, deltas: new Array(g.n).fill(0), hands: [], dealerBefore: g.dealer }, dealerStays, false)
  let g = mk(2); g.roundIndex = 7; g.players.forEach((p, i) => (p.points = [26000, 25000, 24000, 25000][i])); finishDraw(g, false)
  eq('end of South with nobody at 30000 -> extends into West', (g as any).pendingOver, false)
  g = mk(2); g.roundIndex = 7; g.players.forEach((p, i) => (p.points = [31000, 25000, 20000, 24000][i])); finishDraw(g, false)
  eq('end of South with a player at 30000+ -> game over', (g as any).pendingOver, true)
  g = mk(2); g.roundIndex = 11; g.players.forEach((p) => (p.points = 25000)); finishDraw(g, false)
  eq('extension is limited to one more wind', (g as any).pendingOver, true)
  g = mk(2); g.roundIndex = 7; g.dealer = 3; g.players.forEach((p, i) => (p.points = [20000, 22000, 23000, 35000][i])); finishWin(g, 3, true)
  eq('agari-yame: dealer wins the last hand in 1st with 30000+ -> over', (g as any).pendingOver, true)
  g = mk(2); g.roundIndex = 7; g.dealer = 3; g.players.forEach((p, i) => (p.points = [20000, 22000, 33000, 25000][i])); finishWin(g, 3, true)
  eq('dealer wins last hand but is not 1st -> game continues', (g as any).pendingOver, false)
  g = mk(2); g.roundIndex = 3; g.players.forEach((p, i) => (p.points = [-100, 30000, 40000, 30100][i])); finishDraw(g, false)
  eq('a bust (below 0) ends the game', (g as any).pendingOver, true)
  g = mk(1, 3); g.roundIndex = 3; g.players.forEach((p, i) => (p.points = [30000, 35000, 40000][i])); finishDraw(g, false)
  eq('sanma return is 40000: 40000 reached -> over', (g as any).pendingOver, true)
  g = mk(1, 3); g.roundIndex = 3; g.players.forEach((p, i) => (p.points = [30000, 35000, 38000][i])); finishDraw(g, false)
  eq('sanma: nobody at 40000 -> extends', (g as any).pendingOver, false)
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

// --- Taiwanese ---
const names = (t: ReturnType<typeof setup>) => run(t)!.yaku.map((y) => y.name)
{
  const t = setup('taiwan', '111m222m333m444m555m6m', '6m', { tsumo: false })
  const n = names(t)
  eq('tw pure one suit + all triplets + five concealed', ['Pure One Suit', 'All Triplets', 'Five Concealed Triplets'].every((x) => n.includes(x)), true)
}
{
  const t = setup('taiwan', '123m456m789m123p456p4p', '4p')
  eq('tw concealed self-draw = 3 tai (replaces concealed + self-draw)', names(t).includes('Concealed Self-draw') && !names(t).includes('Self-draw'), true)
}
{
  const t = setup('taiwan', '123m456m789m123p45p77s', '3p', { tsumo: false })
  const sc = run(t)!
  eq('tw pinghu ron: concealed 1 + pinghu 2 = 3 tai', [sc.yaku.map((y) => y.name).includes('Pinghu (All Sequences)'), sc.total], [true, 3])
  eq('tw discarder-only payment; dealer discarder owes +1 tai (30+10*4)', pay(t), [-70, 70, 0, 0])
}
{
  const t = setup('taiwan', '123m456m789m123p45p77s', '3p', { tsumo: false, flowers: [34, 35] })
  eq('tw pinghu blocked by flowers', names(t).includes('Pinghu (All Sequences)'), false)
}
{
  const t = setup('taiwan', '123m456m789m123p456p4p', '4p', { seat: 0, lian: 2 })
  const sc = run(t)!
  const y = sc.yaku.map((q) => q.name)
  eq('tw dealer + streak counted when dealer wins', [y.includes('Dealer'), sc.yaku.find((q) => q.name.startsWith('Dealer Streak'))?.value], [true, 4])
}
{
  const score = { yaku: [], total: 5, base: 80 }
  const rule = new Game('taiwan', { rule: 'taiwan' } as any, ['a', 'b', 'c', 'd']).rule
  eq('tw dealer pays streak bonus on ron (1+2*2 extra tai)', rule.settle(score, { winner: 1, from: 0, dealer: 0, honba: 0, lianZhuang: 2 }), [-130, 130, 0, 0])
  eq('tw dealer pays more on tsumo, others normal', rule.settle(score, { winner: 1, from: null, dealer: 0, honba: 0, lianZhuang: 2 }), [-130, 340, -80, -80].map((x, i) => (i === 1 ? 290 : x)))
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed')
process.exit(fails ? 1 : 0)
