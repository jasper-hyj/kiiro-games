import type { HandScore, Interp, RuleSet, WinContext, YakuItem } from './types'
import { closedHand, interpretations } from './common'
import { isChiitoi, isKokushi, suitCounts, type SetInfo } from '../hand'
import { isDragon, isHonor, isSimple, isTerminal, isTermOrHonor, numOf, suitOf } from '../tiles'

const ceil100 = (n: number) => Math.ceil(n / 100) * 100

function limitOf(han: number, fu: number, yakuman: number): { base: number; label?: string } {
  if (yakuman > 0) return { base: 8000 * yakuman, label: yakuman > 1 ? `${yakuman}x Yakuman` : 'Yakuman' }
  if (han >= 13) return { base: 8000, label: 'Kazoe Yakuman' }
  if (han >= 11) return { base: 6000, label: 'Sanbaiman' }
  if (han >= 8) return { base: 4000, label: 'Baiman' }
  if (han >= 6) return { base: 3000, label: 'Haneman' }
  const b = fu * Math.pow(2, han + 2)
  if (han >= 5 || b >= 2000) return { base: 2000, label: 'Mangan' }
  return { base: b }
}

/** Yaku that only depend on which tiles are present (valid for any hand shape). */
function tileYaku(ctx: WinContext, closed: boolean, out: YakuItem[], yakuman: YakuItem[]) {
  const c = ctx.allKinds
  const kinds = c.map((v, k) => (v ? k : -1)).filter((k) => k >= 0)
  const sc = suitCounts(c)
  const suitsUsed = [0, 1, 2].filter((s) => sc[s] > 0).length
  const honors = sc[3] > 0
  if (kinds.every(isHonor)) yakuman.push({ name: 'Tsuuiisou (All Honors)', zh: '字一色', value: 13, yakuman: true })
  if (kinds.every((k) => isTerminal(k))) yakuman.push({ name: 'Chinroutou (All Terminals)', zh: '清老頭', value: 13, yakuman: true })
  if (kinds.every((k) => [19, 20, 21, 23, 25, 32].includes(k))) yakuman.push({ name: 'Ryuuiisou (All Green)', zh: '綠一色', value: 13, yakuman: true })
  if (ctx.melds.length === 0 && suitsUsed === 1 && !honors) {
    const s = [0, 1, 2].find((x) => sc[x] > 0)!
    const b = s * 9
    const ok = c[b] >= 3 && c[b + 8] >= 3 && [1, 2, 3, 4, 5, 6, 7].every((i) => c[b + i] >= 1)
    if (ok) {
      // the pure form (1112345678999 before the winning tile: the nine-sided wait) counts double
      const pre = c.slice(b, b + 9); if (ctx.winKind >= b && ctx.winKind < b + 9) pre[ctx.winKind - b]--
      const junsei = [3, 1, 1, 1, 1, 1, 1, 1, 3].every((n, i) => pre[i] === n)
      yakuman.push(junsei ? { name: 'Junsei Chuuren Poutou (Pure Nine Gates)', zh: '純正九蓮寶燈', value: 26, yakuman: true } : { name: 'Chuuren Poutou (Nine Gates)', zh: '九蓮寶燈', value: 13, yakuman: true })
    }
  }
  if (suitsUsed === 1 && !honors) out.push({ name: 'Chinitsu (Full Flush)', zh: '清一色', value: closed ? 6 : 5 })
  else if (suitsUsed === 1 && honors) out.push({ name: 'Honitsu (Half Flush)', zh: '混一色', value: closed ? 3 : 2 })
  if (kinds.every(isSimple)) out.push({ name: 'Tanyao (All Simples)', zh: '斷幺九', value: 1 })
  if (kinds.every(isTermOrHonor) && !kinds.every(isHonor) && !kinds.every(isTerminal)) out.push({ name: 'Honroutou (All Terminals & Honors)', zh: '混老頭', value: 2 })
}

function situational(ctx: WinContext, closed: boolean, out: YakuItem[]) {
  if (ctx.doubleRiichi) out.push({ name: 'Double Riichi', zh: '雙立直', value: 2 })
  else if (ctx.riichi) out.push({ name: 'Riichi', zh: '立直', value: 1 })
  if (ctx.ippatsu) out.push({ name: 'Ippatsu', zh: '一發', value: 1 })
  if (closed && ctx.tsumo) out.push({ name: 'Menzen Tsumo', zh: '門前清自摸', value: 1 })
  if (ctx.lastTile && ctx.tsumo && !ctx.rinshan) out.push({ name: 'Haitei Raoyue', zh: '海底摸月', value: 1 })
  if (ctx.lastTile && !ctx.tsumo) out.push({ name: 'Houtei Raoyui', zh: '河底撈魚', value: 1 })
  if (ctx.rinshan) out.push({ name: 'Rinshan Kaihou', zh: '嶺上開花', value: 1 })
  if (ctx.chankan) out.push({ name: 'Chankan', zh: '搶槓', value: 1 })
}

function setYaku(ctx: WinContext, it: Interp, closed: boolean, out: YakuItem[], yakuman: YakuItem[]) {
  const { sets, pair } = it
  const seqs = sets.filter((s) => s.type === 'seq')
  const tris = sets.filter((s) => s.type === 'tri')
  const hasSeq = (k: number) => seqs.some((s) => s.kind === k)
  const hasTri = (k: number) => tris.some((s) => s.kind === k)
  const sw = 27 + ctx.seatWind, rw = 27 + ctx.roundWind

  // yakuhai
  for (const t of tris) {
    if (isDragon(t.kind)) out.push({ name: `Yakuhai (${['White', 'Green', 'Red'][t.kind - 31]} Dragon)`, zh: '役牌', value: 1 })
    if (t.kind === sw) out.push({ name: 'Yakuhai (Seat Wind)', zh: '自風', value: 1 })
    if (t.kind === rw) out.push({ name: 'Yakuhai (Round Wind)', zh: '場風', value: 1 })
  }
  // pinfu
  const pairYaku = isDragon(pair) || pair === sw || pair === rw
  if (closed && seqs.length === 4 && !pairYaku && it.waitKind === 'ryanmen') out.push({ name: 'Pinfu', zh: '平和', value: 1 })
  // peikou
  if (closed) {
    const m = new Map<number, number>()
    for (const s of seqs) m.set(s.kind, (m.get(s.kind) ?? 0) + 1)
    let pairs = 0
    m.forEach((v) => (pairs += Math.floor(v / 2)))
    if (pairs >= 2) out.push({ name: 'Ryanpeikou', zh: '二盃口', value: 3 })
    else if (pairs === 1) out.push({ name: 'Iipeikou', zh: '一盃口', value: 1 })
  }
  for (let n = 0; n < 7; n++) if (hasSeq(n) && hasSeq(9 + n) && hasSeq(18 + n)) out.push({ name: 'Sanshoku Doujun', zh: '三色同順', value: closed ? 2 : 1 })
  for (let s = 0; s < 3; s++) if (hasSeq(s * 9) && hasSeq(s * 9 + 3) && hasSeq(s * 9 + 6)) out.push({ name: 'Ittsu (Pure Straight)', zh: '一氣通貫', value: closed ? 2 : 1 })
  for (let n = 0; n < 9; n++) if (hasTri(n) && hasTri(9 + n) && hasTri(18 + n)) out.push({ name: 'Sanshoku Doukou', zh: '三色同刻', value: 2 })
  if (tris.length === 4) out.push({ name: 'Toitoi', zh: '對對和', value: 2 })
  const conc = tris.filter((t) => !t.open).length
  if (conc === 3) out.push({ name: 'Sanankou', zh: '三暗刻', value: 2 })
  if (conc === 4) yakuman.push(it.waitKind === 'tanki' ? { name: 'Suuankou Tanki (Four Concealed Triplets, single wait)', zh: '四暗刻單騎', value: 26, yakuman: true } : { name: 'Suuankou (Four Concealed Triplets)', zh: '四暗刻', value: 13, yakuman: true })
  const kans = tris.filter((t) => t.kan).length
  if (kans === 3) out.push({ name: 'Sankantsu', zh: '三槓子', value: 2 })
  if (kans === 4) yakuman.push({ name: 'Suukantsu (Four Kans)', zh: '四槓子', value: 13, yakuman: true })
  // chanta / junchan
  const sd = (s: SetInfo) => (s.type === 'seq' ? numOf(s.kind) === 1 || numOf(s.kind) === 7 : isTermOrHonor(s.kind))
  if (sets.every(sd) && isTermOrHonor(pair) && seqs.length > 0) {
    const anyHonor = isHonor(pair) || tris.some((t) => isHonor(t.kind))
    if (anyHonor) out.push({ name: 'Chanta', zh: '混全帶幺九', value: closed ? 2 : 1 })
    else out.push({ name: 'Junchan', zh: '純全帶幺九', value: closed ? 3 : 2 })
  }
  // dragons
  const dtri = tris.filter((t) => isDragon(t.kind)).length
  if (dtri === 3) yakuman.push({ name: 'Daisangen (Big Three Dragons)', zh: '大三元', value: 13, yakuman: true })
  else if (dtri === 2 && isDragon(pair)) out.push({ name: 'Shousangen (Little Three Dragons)', zh: '小三元', value: 2 })
  const wtri = tris.filter((t) => t.kind >= 27 && t.kind < 31).length
  if (wtri === 4) yakuman.push({ name: 'Daisuushii (Big Four Winds)', zh: '大四喜', value: 26, yakuman: true })
  else if (wtri === 3 && pair >= 27 && pair < 31) yakuman.push({ name: 'Shousuushii (Little Four Winds)', zh: '小四喜', value: 13, yakuman: true })
}

function calcFu(ctx: WinContext, it: Interp, closed: boolean, pinfu: boolean): number {
  let fu = 20
  if (closed && !ctx.tsumo) fu += 10
  if (ctx.tsumo && !pinfu) fu += 2
  if (pinfu) return ctx.tsumo ? 20 : 30
  for (const s of it.sets) {
    if (s.type !== 'tri') continue
    let f = isTermOrHonor(s.kind) ? 4 : 2
    if (!s.open) f *= 2
    if (s.kan) f *= 4
    fu += f
  }
  const sw = 27 + ctx.seatWind, rw = 27 + ctx.roundWind
  if (isDragon(it.pair)) fu += 2
  if (it.pair === sw) fu += 2
  if (it.pair === rw) fu += 2
  if (it.waitKind === 'kanchan' || it.waitKind === 'penchan' || it.waitKind === 'tanki') fu += 2
  if (!closed && fu === 20) fu = 30
  return Math.ceil(fu / 10) * 10
}

function finish(ctx: WinContext, yaku: YakuItem[], yakuman: YakuItem[], fu: number): HandScore | null {
  if (ctx.firstTurn && ctx.tsumo) yakuman.push(ctx.dealer ? { name: 'Tenhou', zh: '天和', value: 13, yakuman: true } : { name: 'Chiihou', zh: '地和', value: 13, yakuman: true })
  if (yakuman.length) {
    const mult = yakuman.reduce((a, y) => a + y.value / 13, 0) // a double yakuman counts twice
    return { yaku: yakuman, total: 13 * mult, fu, yakuman: mult, ...limitOf(0, 0, mult) }
  }
  const han = yaku.reduce((a, y) => a + y.value, 0)
  if (han === 0) return null
  const all = yaku.slice()
  if (ctx.dora) all.push({ name: `Dora`, zh: '寶牌', value: ctx.dora })
  if (ctx.ura) all.push({ name: `Ura Dora`, zh: '裏寶牌', value: ctx.ura })
  if (ctx.aka) all.push({ name: `Red Five`, zh: '赤牌', value: ctx.aka })
  if (ctx.nuki) all.push({ name: `Nuki Dora (North)`, zh: '拔北', value: ctx.nuki })
  const total = han + ctx.dora + ctx.ura + ctx.aka + ctx.nuki
  return { yaku: all, total, fu, ...limitOf(total, fu, 0) }
}

function evaluate(ctx: WinContext): HandScore | null {
  const closed = closedHand(ctx)
  const noMelds = ctx.melds.length === 0
  const cands: HandScore[] = []

  if (noMelds && isKokushi(ctx.counts)) {
    const thirteenWait = ctx.counts[ctx.winKind] === 2 // the 13 orphans were all there before the winning tile
    const s = finish(ctx, [], [thirteenWait ? { name: 'Kokushi Musou (13-sided wait)', zh: '國士無雙十三面', value: 26, yakuman: true } : { name: 'Kokushi Musou (Thirteen Orphans)', zh: '國士無雙', value: 13, yakuman: true }], 0)
    if (s) cands.push(s)
  }
  if (noMelds && isChiitoi(ctx.counts)) {
    const y: YakuItem[] = [{ name: 'Chiitoitsu (Seven Pairs)', zh: '七對子', value: 2 }]
    const ym: YakuItem[] = []
    situational(ctx, true, y)
    tileYaku(ctx, true, y, ym)
    const s = finish(ctx, y, ym, 25)
    if (s) cands.push(s)
  }
  for (const it of interpretations(ctx, 4)) {
    const y: YakuItem[] = []
    const ym: YakuItem[] = []
    situational(ctx, closed, y)
    tileYaku(ctx, closed, y, ym)
    setYaku(ctx, it, closed, y, ym)
    const pinfu = y.some((q) => q.name === 'Pinfu')
    const s = finish(ctx, y, ym, calcFu(ctx, it, closed, pinfu))
    if (s) cands.push(s)
  }
  if (!cands.length) return null
  const val = (s: HandScore) => s.base * 1000 + s.total * 10 + (s.fu ?? 0) / 10
  return cands.reduce((a, b) => (val(b) > val(a) ? b : a))
}

function settle(score: HandScore, info: { winner: number; from: number | null; dealer: number; honba: number; n?: number }): number[] {
  const n = info.n ?? 4
  const d = new Array(n).fill(0)
  const b = score.base
  const win = info.winner
  const isDealer = win === info.dealer
  if (info.from === null) {
    for (let p = 0; p < n; p++) {
      if (p === win) continue
      const pay = (isDealer || p === info.dealer ? ceil100(2 * b) : ceil100(b)) + 100 * info.honba
      d[p] -= pay; d[win] += pay
    }
  } else {
    const pay = ceil100((isDealer ? 6 : 4) * b) + 300 * info.honba
    d[info.from] -= pay; d[win] += pay
  }
  return d
}

export const riichi: RuleSet = {
  id: 'riichi', name: 'Japanese Riichi', zh: '日本麻雀',
  blurb: '13 tiles · yaku required · riichi, dora & red fives · han/fu scoring',
  handSize: 13, nSets: 4, flowers: false, deadWall: 14, startPoints: 25000, unit: 'pts',
  specials: { chiitoi: true, kokushi: true },
  evaluate, settle,
}
export { suitOf }
