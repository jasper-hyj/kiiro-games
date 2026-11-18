import type { HandScore, RuleSet, WinContext, YakuItem } from './types'
import { closedHand, interpretations } from './common'
import { isChiitoi, isKokushi } from '../hand'
import { isDragon, isHonor, isTerminal, isWind, numOf, suitOf } from '../tiles'

/** Chinese Official (MCR / Guobiao): 13 tiles, 8 flowers, at least 8 fan (flowers do not count toward the minimum),
 *  payment = 8 + fan from the payer(s). Most of the 81 patterns are scored; the knitted hands (全不靠, 七星不靠, 組合龍)
 *  and 和絕張 are not. Overlapping patterns are removed with the official "does not count" relationships. */
const BASE = 8

interface Fan { id: string; name: string; zh: string; v: number }
const F = (id: string, name: string, zh: string, v: number): Fan => ({ id, name, zh, v })

/** id -> ids that are not counted when it is present (a simplified form of the official exclusion rules) */
const EXCLUDES: Record<string, string[]> = {
  bigFourWinds: ['littleFourWinds', 'bigThreeWinds', 'prevalentWind', 'seatWind', 'allPungs', 'pungTH'],
  bigThreeDragons: ['littleThreeDragons', 'twoDragonPungs', 'dragonPung', 'pungTH'],
  allGreen: ['halfFlush'],
  nineGates: ['fullFlush', 'concealedHand', 'noHonors', 'oneVoided', 'pungTH'],
  fourKongs: ['threeKongs', 'allPungs', 'twoConcealedKongs', 'twoMeldedKongs', 'concealedAndMeldedKongs', 'concealedKong', 'meldedKong', 'singleWait'],
  sevenShiftedPairs: ['fullFlush', 'concealedHand', 'sevenPairs', 'noHonors', 'oneVoided', 'singleWait'],
  thirteenOrphans: ['allTypes', 'concealedHand', 'singleWait', 'pungTH'],
  allTerminals: ['allTerminalsAndHonors', 'pungTH', 'allPungs', 'outsideHand', 'doublePung', 'noHonors', 'oneVoided'],
  littleFourWinds: ['bigThreeWinds', 'pungTH'],
  littleThreeDragons: ['twoDragonPungs', 'dragonPung', 'pungTH'],
  allHonors: ['allTerminalsAndHonors', 'allPungs', 'outsideHand', 'pungTH', 'oneVoided'],
  fourConcealedPungs: ['allPungs', 'concealedHand', 'twoConcealedPungs', 'threeConcealedPungs', 'singleWait'],
  pureTerminalChows: ['fullFlush', 'pureDoubleChow', 'allChows', 'shortStraight', 'twoTerminalChows', 'noHonors', 'oneVoided'],
  quadrupleChow: ['pureTripleChow', 'pureDoubleChow', 'tileHog', 'allChows'],
  fourPureShiftedPungs: ['allPungs', 'pureShiftedPungs'],
  fourPureShiftedChows: ['pureShiftedChows', 'shortStraight'],
  threeKongs: ['twoConcealedKongs', 'twoMeldedKongs', 'concealedAndMeldedKongs'],
  allTerminalsAndHonors: ['allPungs', 'pungTH', 'outsideHand'],
  sevenPairs: ['concealedHand', 'singleWait'],
  fullFlush: ['oneVoided', 'noHonors'],
  pureTripleChow: ['pureDoubleChow'],
  allEvenPungs: ['allPungs', 'allSimples', 'noHonors'],
  upperTiles: ['upperFour', 'noHonors'], middleTiles: ['allSimples', 'noHonors'], lowerTiles: ['lowerFour', 'noHonors'],
  pureStraight: ['shortStraight', 'twoTerminalChows'],
  threeSuitedTerminalChows: ['allChows', 'twoTerminalChows', 'mixedDoubleChow', 'noHonors'],
  allFives: ['allSimples', 'noHonors'],
  triplePung: ['doublePung'],
  threeConcealedPungs: ['twoConcealedPungs'],
  bigThreeWinds: ['pungTH'],
  upperFour: ['noHonors'], lowerFour: ['noHonors'],
  reversibleTiles: ['oneVoided'],
  allPungs: [],
  halfFlush: ['oneVoided'],
  meldedHand: ['singleWait'],
  twoConcealedKongs: ['twoConcealedPungs', 'concealedKong'],
  concealedAndMeldedKongs: ['concealedKong', 'meldedKong'],
  twoMeldedKongs: ['meldedKong'],
  fullyConcealed: ['concealedHand', 'selfDrawn'],
  allSimples: ['noHonors'],
  allChows: ['noHonors'],
}


function tileFans(ctx: WinContext, out: Fan[]) {
  const kinds = ctx.allKinds.map((v, k) => (v ? k : -1)).filter((k) => k >= 0)
  const suited = kinds.filter((k) => k < 27)
  const honors = kinds.filter(isHonor)
  const suits = new Set(suited.map(suitOf))
  if (kinds.every(isHonor)) out.push(F('allHonors', 'All Honors', '字一色', 64))
  else if (kinds.every(isTerminal)) out.push(F('allTerminals', 'All Terminals', '清幺九', 64))
  else if (kinds.every((k) => isTerminal(k) || isHonor(k))) out.push(F('allTerminalsAndHonors', 'All Terminals and Honors', '混幺九', 32))
  if (suits.size === 1 && honors.length === 0) out.push(F('fullFlush', 'Full Flush', '清一色', 24))
  else if (suits.size === 1 && honors.length > 0) out.push(F('halfFlush', 'Half Flush', '混一色', 6))
  if (honors.length === 0) {
    if (suited.every((k) => numOf(k) >= 7)) out.push(F('upperTiles', 'Upper Tiles', '全大', 24))
    else if (suited.every((k) => numOf(k) >= 4 && numOf(k) <= 6)) out.push(F('middleTiles', 'Middle Tiles', '全中', 24))
    else if (suited.every((k) => numOf(k) <= 3)) out.push(F('lowerTiles', 'Lower Tiles', '全小', 24))
    else if (suited.every((k) => numOf(k) >= 6)) out.push(F('upperFour', 'Upper Four', '大於五', 12))
    else if (suited.every((k) => numOf(k) <= 4)) out.push(F('lowerFour', 'Lower Four', '小於五', 12))
    if (suited.every((k) => numOf(k) >= 2 && numOf(k) <= 8)) out.push(F('allSimples', 'All Simples', '斷幺', 2))
    out.push(F('noHonors', 'No Honors', '無字', 1))
  }
  if (suits.size === 2) out.push(F('oneVoided', 'One Voided Suit', '缺一門', 1))
  const green = new Set([19, 20, 21, 23, 25, 32]) // 2s 3s 4s 6s 8s + green dragon
  if (kinds.every((k) => green.has(k))) out.push(F('allGreen', 'All Green', '綠一色', 88))
  const rev = new Set([9, 10, 11, 12, 13, 16, 17, 19, 21, 22, 23, 25, 26, 31]) // 1-5,8,9 pin; 2,4,5,6,8,9 sou; white dragon
  if (kinds.every((k) => rev.has(k))) out.push(F('reversibleTiles', 'Reversible Tiles', '推不倒', 8))
  if (suits.size === 3 && kinds.some(isWind) && kinds.some(isDragon)) out.push(F('allTypes', 'All Types', '五門齊', 6))
}

function flagFans(ctx: WinContext, closed: boolean, out: Fan[]) {
  if (ctx.lastTile && ctx.tsumo && !ctx.rinshan) out.push(F('lastTileDraw', 'Last Tile Draw', '妙手回春', 8))
  if (ctx.lastTile && !ctx.tsumo) out.push(F('lastTileClaim', 'Last Tile Claim', '海底撈月', 8))
  if (ctx.rinshan) out.push(F('outWithReplacement', 'Out with Replacement Tile', '槓上開花', 8))
  if (ctx.chankan) out.push(F('robbingKong', 'Robbing the Kong', '搶槓和', 8))
  const exposed = ctx.melds.filter((m) => m.type !== 'ankan').length
  if (closed && ctx.tsumo) out.push(F('fullyConcealed', 'Fully Concealed Hand', '不求人', 4))
  else if (closed) out.push(F('concealedHand', 'Concealed Hand', '門前清', 2))
  else if (ctx.tsumo) out.push(F('selfDrawn', 'Self-Drawn', '自摸', 1))
  if (exposed === 4 && !ctx.tsumo) out.push(F('meldedHand', 'Melded Hand', '全求人', 6))
  const ank = ctx.melds.filter((m) => m.type === 'ankan').length
  const mk = ctx.melds.filter((m) => m.type === 'minkan' || m.type === 'kakan').length
  if (ank + mk === 4) out.push(F('fourKongs', 'Four Kongs', '四槓', 88))
  else if (ank + mk === 3) out.push(F('threeKongs', 'Three Kongs', '三槓', 32))
  else if (ank === 2) out.push(F('twoConcealedKongs', 'Two Concealed Kongs', '雙暗槓', 6))
  else if (ank === 1 && mk === 1) out.push(F('concealedAndMeldedKongs', 'Concealed and Melded Kong', '明暗槓', 5))
  else if (mk === 2) out.push(F('twoMeldedKongs', 'Two Melded Kongs', '雙明槓', 4))
  else if (ank === 1) out.push(F('concealedKong', 'Concealed Kong', '暗槓', 2))
  else if (mk === 1) out.push(F('meldedKong', 'Melded Kong', '明槓', 1))
}

function setFans(ctx: WinContext, it: ReturnType<typeof interpretations>[number], out: Fan[]) {
  const sets = it.sets
  const seqs = sets.filter((s) => s.type === 'seq')
  const tris = sets.filter((s) => s.type === 'tri')
  const sw = 27 + ctx.seatWind, rw = 27 + ctx.roundWind
  const dragons = tris.filter((t) => isDragon(t.kind)).length
  const winds = tris.filter((t) => isWind(t.kind)).length
  // honours
  if (winds === 4) out.push(F('bigFourWinds', 'Big Four Winds', '大四喜', 88))
  else if (winds === 3 && isWind(it.pair)) out.push(F('littleFourWinds', 'Little Four Winds', '小四喜', 64))
  else if (winds === 3) out.push(F('bigThreeWinds', 'Big Three Winds', '三風刻', 12))
  if (dragons === 3) out.push(F('bigThreeDragons', 'Big Three Dragons', '大三元', 88))
  else if (dragons === 2 && isDragon(it.pair)) out.push(F('littleThreeDragons', 'Little Three Dragons', '小三元', 64))
  else if (dragons === 2) out.push(F('twoDragonPungs', 'Two Dragon Pungs', '雙箭刻', 6))
  else if (dragons === 1) out.push(F('dragonPung', 'Dragon Pung', '箭刻', 2))
  for (const t of tris) {
    if (t.kind === rw) out.push(F('prevalentWind', 'Prevalent Wind', '圈風刻', 2))
    if (t.kind === sw) out.push(F('seatWind', 'Seat Wind', '門風刻', 2))
  }
  const pth = tris.filter((t) => !isDragon(t.kind) && t.kind !== rw && t.kind !== sw && (isHonor(t.kind) || isTerminal(t.kind))).length
  if (pth > 0 && !(winds >= 3)) for (let i = 0; i < pth; i++) out.push(F('pungTH', 'Pung of Terminals or Honors', '幺九刻', 1))
  // pungs
  if (tris.length === 4) out.push(F('allPungs', 'All Pungs', '碰碰和', 6))
  const conc = tris.filter((t) => !t.open).length
  if (conc === 4) out.push(F('fourConcealedPungs', 'Four Concealed Pungs', '四暗刻', 64))
  else if (conc === 3) out.push(F('threeConcealedPungs', 'Three Concealed Pungs', '三暗刻', 16))
  else if (conc === 2) out.push(F('twoConcealedPungs', 'Two Concealed Pungs', '雙暗刻', 2))
  const suitedTris = tris.filter((t) => t.kind < 27)
  const byNum = new Map<number, number[]>()
  for (const t of suitedTris) byNum.set(numOf(t.kind), [...(byNum.get(numOf(t.kind)) ?? []), suitOf(t.kind)])
  let dbl = 0
  for (const [, ss] of byNum) { if (new Set(ss).size === 3) out.push(F('triplePung', 'Triple Pung', '三同刻', 16)); else if (ss.length >= 2) dbl++ }
  if (dbl > 0 && !out.some((f) => f.id === 'triplePung')) for (let i = 0; i < dbl; i++) out.push(F('doublePung', 'Double Pung', '雙同刻', 2))
  // shifted pungs (consecutive numbers)
  for (const s of [0, 1, 2]) {
    const ns = suitedTris.filter((t) => suitOf(t.kind) === s).map((t) => numOf(t.kind)).sort((a, b) => a - b)
    const run = (len: number) => ns.some((n) => Array.from({ length: len }, (_, i) => n + i).every((x) => ns.includes(x)))
    if (run(4)) out.push(F('fourPureShiftedPungs', 'Four Pure Shifted Pungs', '一色四節高', 48))
    else if (run(3)) out.push(F('pureShiftedPungs', 'Pure Shifted Pungs', '一色三節高', 24))
  }
  const triNums = [...new Set(suitedTris.map((t) => numOf(t.kind)))]
  for (const n of triNums) {
    const sc = [n, n + 1, n + 2].map((x) => suitedTris.filter((t) => numOf(t.kind) === x).map((t) => suitOf(t.kind)))
    if (sc.every((a) => a.length > 0)) {
      const pick = (i: number, used: number[]): boolean => (i === 3 ? true : sc[i].some((s) => !used.includes(s) && pick(i + 1, [...used, s])))
      if (pick(0, [])) out.push(F('mixedShiftedPungs', 'Mixed Shifted Pungs', '三色三節高', 8))
    }
  }
  if (suitedTris.length === 4 && suitedTris.every((t) => numOf(t.kind) % 2 === 0) && isEvenPair(it.pair)) out.push(F('allEvenPungs', 'All Even Pungs', '全雙刻', 24))
  // chows
  const cnt = new Map<string, number>()
  for (const s of seqs) cnt.set(`${suitOf(s.kind)}:${numOf(s.kind)}`, (cnt.get(`${suitOf(s.kind)}:${numOf(s.kind)}`) ?? 0) + 1)
  const groups = [...cnt.values()]
  if (groups.includes(4)) out.push(F('quadrupleChow', 'Quadruple Chow', '一色四同順', 48))
  else if (groups.includes(3)) out.push(F('pureTripleChow', 'Pure Triple Chow', '一色三同順', 24))
  else { const pairs = groups.filter((g) => g === 2).length; for (let i = 0; i < pairs; i++) out.push(F('pureDoubleChow', 'Pure Double Chow', '一般高', 1)) }
  const startsBySuit = [0, 1, 2].map((s) => seqs.filter((q) => suitOf(q.kind) === s).map((q) => numOf(q.kind)))
  for (const ns of startsBySuit) {
    const has = (n: number) => ns.includes(n)
    if (has(1) && has(4) && has(7)) out.push(F('pureStraight', 'Pure Straight', '清龍', 16))
    for (const step of [1, 2]) {
      for (let n = 1; n <= 7; n++) {
        if (n + 3 * step <= 7 && has(n) && has(n + step) && has(n + 2 * step) && has(n + 3 * step)) out.push(F('fourPureShiftedChows', 'Four Pure Shifted Chows', '一色四步高', 32))
        else if (n + 2 * step <= 7 && has(n) && has(n + step) && has(n + 2 * step)) out.push(F('pureShiftedChows', 'Pure Shifted Chows', '一色三步高', 16))
      }
    }
  }
  const mixedAt = (n: number) => [0, 1, 2].map((s) => startsBySuit[s].includes(n))
  for (let n = 1; n <= 7; n++) if (mixedAt(n).every(Boolean)) out.push(F('mixedTripleChow', 'Mixed Triple Chow', '三色三同順', 8))
  const perm = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
  if (perm.some(([a, b, c]) => startsBySuit[a].includes(1) && startsBySuit[b].includes(4) && startsBySuit[c].includes(7))) out.push(F('mixedStraight', 'Mixed Straight', '花龍', 8))
  for (let n = 1; n <= 5; n++) if (perm.some(([a, b, c]) => startsBySuit[a].includes(n) && startsBySuit[b].includes(n + 1) && startsBySuit[c].includes(n + 2))) { out.push(F('mixedShiftedChows', 'Mixed Shifted Chows', '三色三步高', 6)); break }
  // small chow patterns (counted once each)
  const mixedDouble = (() => { for (let n = 1; n <= 7; n++) if (mixedAt(n).filter(Boolean).length >= 2) return true; return false })()
  if (mixedDouble && !out.some((f) => f.id === 'mixedTripleChow')) out.push(F('mixedDoubleChow', 'Mixed Double Chow', '喜相逢', 1))
  if (startsBySuit.some((ns) => ns.includes(1) && ns.includes(7))) out.push(F('twoTerminalChows', 'Two Terminal Chows', '老少副', 1))
  if (startsBySuit.some((ns) => ns.some((n) => ns.includes(n + 3)))) out.push(F('shortStraight', 'Short Straight', '連六', 1))
  // 3-suited / pure terminal chows
  if (seqs.length === 4 && it.pair < 27 && numOf(it.pair) === 5) {
    const s1 = startsBySuit.map((ns) => ns.filter((n) => n === 1).length === 1 && ns.filter((n) => n === 7).length === 1)
    if (s1.filter(Boolean).length === 2 && s1[suitOf(it.pair)] === false) out.push(F('threeSuitedTerminalChows', 'Three-Suited Terminal Chows', '三色雙龍會', 16))
    const ps = suitOf(it.pair)
    if (startsBySuit[ps].filter((n) => n === 1).length === 2 && startsBySuit[ps].filter((n) => n === 7).length === 2) out.push(F('pureTerminalChows', 'Pure Terminal Chows', '一色雙龍會', 64))
  }
  // sets containing a terminal / a five
  const isTermOrHon = (k: number) => isTerminal(k) || isHonor(k)
  const setHasTerm = (s: { type: string; kind: number }) => (s.type === 'tri' ? isTermOrHon(s.kind) : numOf(s.kind) === 1 || numOf(s.kind) === 7)
  if (seqs.length > 0 && sets.every(setHasTerm) && isTermOrHon(it.pair)) out.push(F('outsideHand', 'Outside Hand', '全帶幺', 4))
  const setHasFive = (s: { type: string; kind: number }) => s.kind < 27 && (s.type === 'tri' ? numOf(s.kind) === 5 : numOf(s.kind) >= 3 && numOf(s.kind) <= 5)
  if (sets.every(setHasFive) && it.pair < 27 && numOf(it.pair) === 5) out.push(F('allFives', 'All Fives', '全帶五', 16))
  if (seqs.length === 4 && !isHonor(it.pair) && !ctx.allKinds.some((v, k) => v > 0 && isHonor(k))) out.push(F('allChows', 'All Chows', '平和', 2))
  // tile hog: four of a kind not declared as a kong
  const kongKinds = new Set(ctx.melds.filter((m) => m.type !== 'pon' && m.type !== 'chi').map((m) => m.tiles[0] >> 2))
  for (let k = 0; k < 34; k++) if (ctx.allKinds[k] === 4 && !kongKinds.has(k)) out.push(F('tileHog', 'Tile Hog', '四歸一', 2))
  // waits count only when the hand can win on that single tile
  if (ctx.waitCount === 1) {
    if (it.waitKind === 'penchan') out.push(F('edgeWait', 'Edge Wait', '邊張', 1))
    else if (it.waitKind === 'kanchan') out.push(F('closedWait', 'Closed Wait', '嵌張', 1))
    else if (it.waitKind === 'tanki') out.push(F('singleWait', 'Single Wait', '單釘', 1))
  }
}
const isEvenPair = (k: number) => k < 27 && numOf(k) % 2 === 0

function nineGates(ctx: WinContext): boolean {
  if (ctx.melds.length > 0) return false
  for (const s of [0, 1, 2]) {
    const c = ctx.counts.slice(s * 9, s * 9 + 9)
    if (c.reduce((a, b) => a + b, 0) !== 14) continue
    const need = [3, 1, 1, 1, 1, 1, 1, 1, 3]
    if (c.every((v, i) => v >= need[i])) return true
  }
  return false
}

function resolve(fans: Fan[], flowers: number): HandScore | null {
  // keep one entry per id for the "single" patterns, repeats only where the rules count each occurrence
  const REPEAT = new Set(['pureDoubleChow', 'pungTH', 'doublePung', 'tileHog'])
  const seen = new Set<string>()
  const uniq = fans.filter((f) => { if (REPEAT.has(f.id)) return true; if (seen.has(f.id)) return false; seen.add(f.id); return true })
  const dropped = new Set<string>()
  for (const f of uniq) for (const x of EXCLUDES[f.id] ?? []) dropped.add(x)
  let kept = uniq.filter((f) => !dropped.has(f.id))
  // three-suited / pure straight style patterns already imply their small chows
  if (kept.length === 0) kept = [F('chicken', 'Chicken Hand', '無番和', 8)]
  const yaku: YakuItem[] = kept.map((f) => ({ name: f.name, zh: f.zh, value: f.v }))
  if (flowers > 0) yaku.push({ name: `Flowers ×${flowers}`, zh: `花牌 ×${flowers}`, value: flowers })
  const total = yaku.reduce((a, y) => a + y.value, 0)
  return { yaku, total, base: BASE }
}

function evaluate(ctx: WinContext): HandScore | null {
  const closed = closedHand(ctx)
  const min = ctx.options.minFan ?? 8
  const cands: HandScore[] = []
  const push = (fans: Fan[]) => {
    const s = resolve(fans, ctx.flowers.length)
    if (s && s.total - ctx.flowers.length >= min) cands.push(s)
  }
  const flags: Fan[] = []
  flagFans(ctx, closed, flags)
  const tiles: Fan[] = []
  tileFans(ctx, tiles)
  if (ctx.melds.length === 0 && isKokushi(ctx.counts)) push([F('thirteenOrphans', 'Thirteen Orphans', '十三幺', 88), ...flags])
  if (ctx.melds.length === 0 && isChiitoi(ctx.counts)) {
    const fans = [...flags, ...tiles]
    // seven shifted pairs: seven consecutive pairs of one suit
    const ks = ctx.counts.map((v, k) => (v ? k : -1)).filter((k) => k >= 0)
    if (ks.length === 7 && ks.every((k) => k < 27 && suitOf(k) === suitOf(ks[0])) && ks[6] - ks[0] === 6) fans.push(F('sevenShiftedPairs', 'Seven Shifted Pairs', '連七對', 88))
    else fans.push(F('sevenPairs', 'Seven Pairs', '七對', 24))
    push(fans)
  }
  if (nineGates(ctx)) push([F('nineGates', 'Nine Gates', '九蓮寶燈', 88), ...flags, ...tiles])
  for (const it of interpretations(ctx, 4)) {
    const fans: Fan[] = [...flags, ...tiles]
    setFans(ctx, it, fans)
    push(fans)
  }
  if (!cands.length) return null
  return cands.reduce((a, b) => (b.total > a.total ? b : a))
}

function settle(score: HandScore, info: { winner: number; from: number | null }): number[] {
  const d = [0, 0, 0, 0]
  const T = score.total
  if (info.from === null) {
    for (let p = 0; p < 4; p++) if (p !== info.winner) { d[p] -= BASE + T; d[info.winner] += BASE + T }
  } else {
    for (let p = 0; p < 4; p++) {
      if (p === info.winner) continue
      const pay = p === info.from ? BASE + T : BASE
      d[p] -= pay; d[info.winner] += pay
    }
  }
  return d
}

export const mcr: RuleSet = {
  id: 'mcr', name: 'Chinese Official', zh: '國標麻將',
  blurb: '13 tiles · 8 flowers · 8-fan minimum · ~80 scoring patterns',
  handSize: 13, nSets: 4, flowers: true, deadWall: 14, startPoints: 0, unit: 'pts',
  specials: { chiitoi: true, kokushi: true },
  evaluate, settle,
}
