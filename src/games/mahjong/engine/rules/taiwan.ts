import type { HandScore, RuleSet, WinContext, YakuItem } from './types'
import { closedHand, flowerSetBonus, interpretations } from './common'
import { suitCounts } from '../hand'
import { flowerSeat, isDragon, isHonor } from '../tiles'

export const TW_BASE = 30
export const TW_PER_TAI = 10

function evaluate(ctx: WinContext): HandScore | null {
  const closed = closedHand(ctx)
  const cands: HandScore[] = []
  const kinds = ctx.allKinds.map((v, k) => (v ? k : -1)).filter((k) => k >= 0)
  const sc = suitCounts(ctx.allKinds)
  const suitsUsed = [0, 1, 2].filter((s) => sc[s] > 0).length

  for (const it of interpretations(ctx, 5)) {
    const y: YakuItem[] = []
    if (ctx.dealer) {
      y.push({ name: 'Dealer', zh: '莊家', value: 1 })
      if (ctx.lianZhuang > 0) y.push({ name: `Dealer Streak ×${ctx.lianZhuang}`, zh: `連莊拉莊 ×${ctx.lianZhuang}`, value: 2 * ctx.lianZhuang })
    }
    if (closed && ctx.tsumo) y.push({ name: 'Concealed Self-draw', zh: '門清自摸', value: 3 })
    else if (closed) y.push({ name: 'Concealed Hand', zh: '門清', value: 1 })
    else if (ctx.tsumo) y.push({ name: 'Self-draw', zh: '自摸', value: 1 })
    if (!ctx.tsumo && ctx.melds.length === 5 && ctx.melds.every((m) => m.type !== 'ankan')) y.push({ name: 'All Exposed', zh: '全求人', value: 2 })
    const tris = it.sets.filter((s) => s.type === 'tri')
    const seqs = it.sets.filter((s) => s.type === 'seq')
    const sw = 27 + ctx.seatWind,
      rw = 27 + ctx.roundWind
    for (const t of tris) {
      if (isDragon(t.kind)) y.push({ name: 'Dragon Triplet', zh: '三元牌', value: 1 })
      if (t.kind === sw) y.push({ name: 'Seat Wind', zh: '門風', value: 1 })
      if (t.kind === rw) y.push({ name: 'Round Wind', zh: '圈風', value: 1 })
    }
    const own = ctx.flowers.filter((k) => flowerSeat(k) === ctx.seatWind).length
    if (own) y.push({ name: `Seat Flower ×${own}`, zh: `花牌 ×${own}`, value: own })
    const fs = flowerSetBonus(ctx.flowers)
    if (fs) y.push({ name: 'Flower Set', zh: '花槓', value: 2 * fs })
    if (seqs.length === 5 && sc[3] === 0 && ctx.flowers.length === 0 && it.waitKind === 'ryanmen')
      y.push({ name: 'Pinghu (All Sequences)', zh: '平胡', value: 2 })
    if (ctx.waitCount === 1 && (it.waitKind === 'kanchan' || it.waitKind === 'penchan' || it.waitKind === 'tanki'))
      y.push({ name: 'Single Wait', zh: '獨聽', value: 1 })
    if (tris.length === 5) y.push({ name: 'All Triplets', zh: '碰碰胡', value: 4 })
    const conc = tris.filter((t) => !t.open).length
    if (conc === 5) y.push({ name: 'Five Concealed Triplets', zh: '五暗刻', value: 8 })
    else if (conc === 4) y.push({ name: 'Four Concealed Triplets', zh: '四暗刻', value: 5 })
    else if (conc === 3) y.push({ name: 'Three Concealed Triplets', zh: '三暗刻', value: 2 })
    const dt = tris.filter((t) => isDragon(t.kind)).length
    if (dt === 3) y.push({ name: 'Big Three Dragons', zh: '大三元', value: 8 })
    else if (dt === 2 && isDragon(it.pair)) y.push({ name: 'Small Three Dragons', zh: '小三元', value: 4 })
    const wt = tris.filter((t) => t.kind >= 27 && t.kind < 31).length
    if (wt === 4) y.push({ name: 'Big Four Winds', zh: '大四喜', value: 16 })
    else if (wt === 3 && it.pair >= 27 && it.pair < 31) y.push({ name: 'Small Four Winds', zh: '小四喜', value: 8 })
    if (kinds.every(isHonor)) y.push({ name: 'All Honors', zh: '字一色', value: 16 })
    else if (suitsUsed === 1 && sc[3] === 0) y.push({ name: 'Pure One Suit', zh: '清一色', value: 8 })
    else if (suitsUsed === 1) y.push({ name: 'Mixed One Suit', zh: '混一色', value: 4 })
    if (ctx.lastTile && ctx.tsumo && !ctx.rinshan) y.push({ name: 'Last Tile from Wall', zh: '海底撈月', value: 1 })
    if (ctx.lastTile && !ctx.tsumo) y.push({ name: 'Last Discard', zh: '河底撈魚', value: 1 })
    if (ctx.rinshan) y.push({ name: 'Win on Kong', zh: '槓上開花', value: 1 })
    if (ctx.chankan) y.push({ name: 'Robbing the Kong', zh: '搶槓', value: 1 })
    if (ctx.firstTurn && ctx.tsumo) y.push(ctx.dealer ? { name: 'Heavenly Hand', zh: '天胡', value: 16 } : { name: 'Earthly Hand', zh: '地胡', value: 16 })
    const tai = y.reduce((a, q) => a + q.value, 0)
    cands.push({ yaku: y, total: tai, base: TW_BASE + TW_PER_TAI * tai })
  }
  if (!cands.length) return null
  return cands.reduce((a, b) => (b.total > a.total ? b : a))
}

function settle(score: HandScore, info: { winner: number; from: number | null; dealer: number; lianZhuang: number }): number[] {
  const d = [0, 0, 0, 0]
  // Dealer streak bonus is already in the winner's tai when the dealer wins; if the dealer *pays*, they owe it too.
  const pay = (p: number) => {
    const extra = p === info.dealer && info.winner !== info.dealer ? 1 + 2 * info.lianZhuang : 0
    return TW_BASE + TW_PER_TAI * (score.total + extra)
  }
  if (info.from === null) {
    for (let p = 0; p < 4; p++)
      if (p !== info.winner) {
        d[p] -= pay(p)
        d[info.winner] += pay(p)
      }
  } else {
    d[info.from] -= pay(info.from)
    d[info.winner] += pay(info.from)
  }
  return d
}

export const taiwan: RuleSet = {
  id: 'taiwan',
  name: 'Taiwanese',
  zh: '台灣麻將',
  blurb: '16 tiles · 8 flowers · tai scoring · dealer streaks (連莊)',
  handSize: 16,
  nSets: 5,
  flowers: true,
  deadWall: 16,
  startPoints: 1000,
  unit: 'pts',
  specials: {},
  evaluate,
  settle,
}
