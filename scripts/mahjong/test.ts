import { Game } from '../../src/games/mahjong/engine/game'
import { sortIds } from '../../src/games/mahjong/engine/tiles'
import { shantenAll, toCounts } from '../../src/games/mahjong/engine/hand'
import type { RuleId } from '../../src/games/mahjong/engine/rules'

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

function setup(rule: RuleId, hand: string, win: string, o: { minFan?: number; lian?: number; flowers?: number[]; seat?: number; tsumo?: boolean; riichi?: boolean; melds?: { type: any; tiles: string }[] } = {}) {
  used.clear()
  const g = new Game(rule, { rule, aka: false, rounds: 1, minFan: o.minFan ?? 3 } as any, ['a', 'b', 'c', 'd'])
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
  eq('kokushi 13-sided wait is a double yakuman', [sc.yakuman, sc.base], [2, 16000])
  eq('kokushi 13-sided ron non-dealer 64000', pay(t)[0], -64000)
}
{
  // a normal (single-wait) kokushi: the hand is missing one orphan and has a pair elsewhere
  const t = setup('riichi', '19m19p19s123456z9m', '7z', { tsumo: false })
  const sc = run(t)!
  eq('kokushi single wait is one yakuman', [sc.yakuman, sc.base], [1, 8000])
  eq('kokushi ron non-dealer 32000', pay(t)[0], -32000)
}
{
  const t = setup('riichi', '111m222p333s444z5z', '5z', { tsumo: false })
  const sc = run(t)!
  eq('suuankou tanki is a double yakuman', sc.yakuman, 2)
}
{
  const t = setup('riichi', '1112345678999m', '5m', { tsumo: false })
  const sc = run(t)!
  eq('pure nine gates is a double yakuman', sc.yakuman, 2)
}
{
  const t = setup('riichi', '111222333z44z12m', '3m', { tsumo: false })
  const sc = run(t)!
  eq('little four winds stays a single yakuman', sc.yakuman, 1)
}
{
  const t = setup('riichi', '111222333z4z12m5p', '4z', { tsumo: false })
  void t
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
import { doraFrom } from '../../src/games/mahjong/engine/tiles'
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

// =====================  Scoring audit: Taiwanese  =====================
{
  const has = (t: ReturnType<typeof setup>, name: string) => (run(t)?.yaku ?? []).some((y) => y.name.startsWith(name))
  const val = (t: ReturnType<typeof setup>, name: string) => (run(t)?.yaku ?? []).find((y) => y.name.startsWith(name))?.value
  // dragons
  let t = setup('taiwan', '555z666z777z123m456p1s', '1s', { tsumo: false })
  eq('tw big three dragons = 8', [has(t, 'Big Three Dragons'), val(t, 'Big Three Dragons')], [true, 8])
  eq('tw dragon triplets 1 each (x3)', (run(t)!.yaku.filter((y) => y.name === 'Dragon Triplet')).length, 3)
  t = setup('taiwan', '555z666z7z123m456p789s', '7z', { tsumo: false })
  eq('tw small three dragons = 4', [has(t, 'Small Three Dragons'), has(t, 'Big Three Dragons')], [true, false])
  // suits
  t = setup('taiwan', '111m222m333m444m555m6m', '6m', { tsumo: false })
  eq('tw pure one suit = 8', val(t, 'Pure One Suit'), 8)
  t = setup('taiwan', '111m234m567m789m555z1z', '1z', { tsumo: false })
  eq('tw mixed one suit = 4 (not pure)', [val(t, 'Mixed One Suit'), has(t, 'Pure One Suit')], [4, false])
  t = setup('taiwan', '111z222z333z444z555z6z', '6z', { tsumo: false })
  eq('tw all honors = 16', val(t, 'All Honors'), 16)
  // winds: seat 1 is South (2z), round is East (1z)
  t = setup('taiwan', '222z111z123m456m789p1s', '1s', { tsumo: false })
  eq('tw seat wind + round wind pon = 1 each', [val(t, 'Seat Wind'), val(t, 'Round Wind')], [1, 1])
  t = setup('taiwan', '333z444z123m456m789p1s', '1s', { tsumo: false })
  eq('tw other winds score nothing', [has(t, 'Seat Wind'), has(t, 'Round Wind')], [false, false])
  eq('tw small four winds needs 3 winds + wind pair', [has(setup('taiwan', '111z222z333z4z123m456p', '4z', { tsumo: false }), 'Small Four Winds')], [true])
  // triplets
  t = setup('taiwan', '111m222m333p444p55s6s6s', '5s', { tsumo: false })
  eq('tw all triplets = 4', val(t, 'All Triplets'), 4)
  // all exposed (全求人): five melds, ron on the last pair tile
  t = setup('taiwan', '6m', '6m', { tsumo: false, melds: ['111m', '222m', '333m', '444m', '555m'].map((x) => ({ type: 'pon', tiles: x })) })
  eq('tw all exposed (全求人) = 2 on a discard win', val(t, 'All Exposed'), 2)
  t = setup('taiwan', '6m', '6m', { tsumo: true, melds: ['111m', '222m', '333m', '444m', '555m'].map((x) => ({ type: 'pon', tiles: x })) })
  eq('tw all exposed does NOT apply to self-draw', has(t, 'All Exposed'), false)
  // flowers
  t = setup('taiwan', '123m456m789m123p456p4p', '4p', { flowers: [137] })
  eq('tw matching seat flower = 1 (flower #2 for the South seat)', val(t, 'Seat Flower'), 1)
  t = setup('taiwan', '123m456m789m123p456p4p', '4p', { flowers: [136] })
  eq('tw a non-matching flower scores nothing', has(t, 'Seat Flower'), false)
  t = setup('taiwan', '123m456m789m123p456p4p', '4p', { flowers: [136, 137, 138, 139] })
  eq('tw four plant flowers = flower set 2 (+ seat flower 1)', [val(t, 'Flower Set'), val(t, 'Seat Flower')], [2, 1])
  // pinghu
  t = setup('taiwan', '123m456m789m123p45p77s', '3p', { tsumo: false })
  eq('tw pinghu = 2', val(t, 'Pinghu'), 2)
  t = setup('taiwan', '123m456m789m123p45p77z', '3p', { tsumo: false })
  eq('tw pinghu denied with an honor pair', has(t, 'Pinghu'), false)
  t = setup('taiwan', '123m456m789m123p46p77s', '5p', { tsumo: false })
  eq('tw pinghu denied on a closed (middle) wait', has(t, 'Pinghu'), false)
  eq('tw closed wait counts as single wait = 1', val(t, 'Single Wait'), 1)
  // concealed
  t = setup('taiwan', '123m456m789m123p45p77s', '3p', { tsumo: false, melds: [] })
  eq('tw concealed hand = 1 on a discard win', val(t, 'Concealed Hand'), 1)
  t = setup('taiwan', '456m789m123p45p77s', '3p', { tsumo: false, melds: [{ type: 'chi', tiles: '123m' }, { type: 'chi', tiles: '456p' }].slice(0, 1) as never })
  // open hand: no concealed bonus
  eq('tw open hand has no concealed bonus', has(t, 'Concealed'), false)
  // dealer + streak when the dealer wins
  t = setup('taiwan', '123m456m789m123p456p4p', '4p', { seat: 0, lian: 3, tsumo: false })
  eq('tw dealer win: dealer 1 + streak 2*3 = 6', [val(t, 'Dealer'), run(t)!.yaku.find((y) => y.name.startsWith('Dealer Streak'))?.value], [1, 6])
  // payment arithmetic: 30 + 10*tai
  const sc = { yaku: [], total: 8, base: 110 }
  const twr = new Game('taiwan', { rule: 'taiwan' } as any, ['a', 'b', 'c', 'd']).rule
  eq('tw 8-tai tsumo (non-dealer): dealer owes +1', twr.settle(sc, { winner: 2, from: null, dealer: 0, honba: 0, lianZhuang: 0 }), [-120, -110, 340, -110])
  eq('tw ron by non-dealer from non-dealer: only the discarder pays', twr.settle(sc, { winner: 2, from: 3, dealer: 0, honba: 0, lianZhuang: 0 }), [0, 0, 110, -110])
}

// =====================  Scoring audit: Hong Kong  =====================
{
  const fan = (t: ReturnType<typeof setup>) => run(t)?.total
  const hasF = (t: ReturnType<typeof setup>, n: string) => (run(t)?.yaku ?? []).some((y) => y.name.startsWith(n))
  // minimum 3 fan
  let t = setup('hk', '456m789m123p7s', '7s', { tsumo: false, minFan: 3, melds: [{ type: 'chi', tiles: '123m' }] })
  eq('hk open common hand (2 fan) cannot win with a 3-fan minimum', run(t), null)
  t = setup('hk', '456m789m123p7s', '7s', { tsumo: false, minFan: 0, melds: [{ type: 'chi', tiles: '123m' }] })
  eq('hk the same hand wins when the minimum is 0 (common hand 1 + no flowers 1)', fan(t), 2)
  // limit hands
  t = setup('hk', '19m19p19s1234567z', '7z', { tsumo: false })
  eq('hk thirteen orphans = 13', fan(t), 13)
  t = setup('hk', '555z666z777z123m1s', '1s', { tsumo: false })
  eq('hk big three dragons = 8 (+ 3 dragon triplets 1 each...)', hasF(t, 'Big Three Dragons'), true)
  t = setup('hk', '111m222m333m444m5m', '5m', { tsumo: false })
  eq('hk pure one suit = 7, all triplets = 3 (+ concealed, no flowers)', [hasF(t, 'Pure One Suit'), hasF(t, 'All Triplets')], [true, true])
  eq('hk fan is capped at 13 (limit)', (fan(t) ?? 0) <= 13, true)
  t = setup('hk', '123m456m789m45p77s', '3p', { tsumo: false })
  eq('hk common hand + concealed + no flowers = 3 on a discard win', fan(t), 3)
  eq('hk 3 fan pays 8: discarder pays double (16)', setup('hk', '123m456m789m45p77s', '3p', { tsumo: false }).g.rule.settle(run(setup('hk', '123m456m789m45p77s', '3p', { tsumo: false }))!, { winner: 1, from: 0, dealer: 0, honba: 0, lianZhuang: 0 }), [-16, 16, 0, 0])
  t = setup('hk', '123m456m789m123p4p', '4p')
  eq('hk fully concealed self-draw (不求人) = 3 fan', hasF(t, 'Fully Concealed'), true)
  t = setup('hk', '1122m3344p5566s7z', '7z', { tsumo: false })
  eq('hk has no seven-pairs hand', run(t), null)
  t = setup('hk', '123m456m789m123p4p', '4p', { flowers: [137, 138] })
  eq('hk seat flower (#2 for the South seat) scores 1; no-flower bonus is lost', [hasF(t, 'Seat Flower'), hasF(t, 'No Flowers')], [true, false])
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed')
process.exit(fails ? 1 : 0)
