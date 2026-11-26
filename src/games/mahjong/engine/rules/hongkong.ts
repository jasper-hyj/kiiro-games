import type { HandScore, RuleSet, WinContext, YakuItem } from './types'
import { closedHand, flowerSetBonus, interpretations } from './common'
import { isKokushi, suitCounts } from '../hand'
import { flowerSeat, isDragon, isHonor, isTerminal, isTermOrHonor } from '../tiles'

const TABLE = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128]
export const hkValue = (fan: number) => TABLE[Math.min(Math.max(fan, 0), 10)]

function evaluate(ctx: WinContext): HandScore | null {
  const closed = closedHand(ctx)
  const cands: HandScore[] = []
  const common = (): YakuItem[] => {
    const y: YakuItem[] = []
    if (ctx.tsumo && closed) y.push({ name: 'Fully Concealed (Self-drawn)', zh: '不求人', value: 3 })
    else if (ctx.tsumo) y.push({ name: 'Self-drawn', zh: '自摸', value: 1 })
    else if (closed) y.push({ name: 'Concealed Hand', zh: '門前清', value: 1 })
    if (ctx.lastTile && ctx.tsumo && !ctx.rinshan) y.push({ name: 'Last Tile from Wall', zh: '海底撈月', value: 1 })
    if (ctx.lastTile && !ctx.tsumo) y.push({ name: 'Last Discard', zh: '河底撈魚', value: 1 })
    if (ctx.rinshan) y.push({ name: 'Win on Kong', zh: '槓上開花', value: 1 })
    if (ctx.chankan) y.push({ name: 'Robbing the Kong', zh: '搶槓', value: 1 })
    if (ctx.firstTurn && ctx.tsumo) y.push(ctx.dealer ? { name: 'Heavenly Hand', zh: '天胡', value: 13 } : { name: 'Earthly Hand', zh: '地胡', value: 13 })
    // flowers
    const own = ctx.flowers.filter((k) => flowerSeat(k) === ctx.seatWind).length
    if (own) y.push({ name: `Seat Flower ×${own}`, zh: `正花 ×${own}`, value: own })
    if (ctx.flowers.length === 0) y.push({ name: 'No Flowers', zh: '無花', value: 1 })
    const fs = flowerSetBonus(ctx.flowers)
    if (fs) y.push({ name: 'Complete Flower Set', zh: '一台花', value: 2 * fs })
    return y
  }
  const done = (y: YakuItem[]): HandScore | null => {
    const fan = Math.min(
      13,
      y.reduce((a, q) => a + q.value, 0),
    )
    if (fan < ctx.options.minFan) return null
    return { yaku: y, total: fan, base: hkValue(fan), label: fan >= 13 ? 'Limit' : undefined }
  }

  if (ctx.melds.length === 0 && isKokushi(ctx.counts)) {
    const s = done([{ name: 'Thirteen Orphans', zh: '十三幺', value: 13 }])
    if (s) cands.push(s)
  }
  const kinds = ctx.allKinds.map((v, k) => (v ? k : -1)).filter((k) => k >= 0)
  const sc = suitCounts(ctx.allKinds)
  const suitsUsed = [0, 1, 2].filter((s) => sc[s] > 0).length
  for (const it of interpretations(ctx, 4)) {
    const y = common()
    const tris = it.sets.filter((s) => s.type === 'tri')
    const seqs = it.sets.filter((s) => s.type === 'seq')
    const sw = 27 + ctx.seatWind,
      rw = 27 + ctx.roundWind
    let limit = false
    for (const t of tris) {
      if (isDragon(t.kind)) y.push({ name: 'Dragon Triplet', zh: '三元牌', value: 1 })
      if (t.kind === sw) y.push({ name: 'Seat Wind', zh: '門風', value: 1 })
      if (t.kind === rw) y.push({ name: 'Round Wind', zh: '圈風', value: 1 })
    }
    if (seqs.length === 4 && !isHonor(it.pair)) y.push({ name: 'Common Hand', zh: '平胡', value: 1 })
    if (tris.length === 4) y.push({ name: 'All Triplets', zh: '對對胡', value: 3 })
    if (tris.filter((t) => !t.open).length === 4) y.push({ name: 'Four Concealed Triplets', zh: '四暗刻', value: 8 })
    const dt = tris.filter((t) => isDragon(t.kind)).length
    if (dt === 3) y.push({ name: 'Big Three Dragons', zh: '大三元', value: 8 })
    else if (dt === 2 && isDragon(it.pair)) y.push({ name: 'Small Three Dragons', zh: '小三元', value: 5 })
    const wt = tris.filter((t) => t.kind >= 27 && t.kind < 31).length
    if (wt === 4) {
      y.push({ name: 'Big Four Winds', zh: '大四喜', value: 13 })
      limit = true
    } else if (wt === 3 && it.pair >= 27 && it.pair < 31) y.push({ name: 'Small Four Winds', zh: '小四喜', value: 10 })
    if (tris.filter((t) => t.kan).length === 4) {
      y.push({ name: 'Four Kongs', zh: '十八羅漢', value: 13 })
      limit = true
    }
    if (kinds.every(isHonor)) y.push({ name: 'All Honors', zh: '字一色', value: 10 })
    else if (kinds.every(isTerminal)) y.push({ name: 'All Terminals', zh: '清幺九', value: 10 })
    else if (kinds.every(isTermOrHonor)) y.push({ name: 'Mixed Terminals', zh: '混幺九', value: 7 })
    if (suitsUsed === 1 && sc[3] === 0) y.push({ name: 'Pure One Suit', zh: '清一色', value: 7 })
    else if (suitsUsed === 1) y.push({ name: 'Mixed One Suit', zh: '混一色', value: 3 })
    void limit
    const s = done(y)
    if (s) cands.push(s)
  }
  if (!cands.length) return null
  return cands.reduce((a, b) => (b.total > a.total ? b : a))
}

function settle(score: HandScore, info: { winner: number; from: number | null; n?: number }): number[] {
  const n = info.n ?? 4
  const d = new Array(n).fill(0)
  const V = score.base
  if (info.from === null) {
    for (let p = 0; p < n; p++)
      if (p !== info.winner) {
        d[p] -= V
        d[info.winner] += V
      }
  } else {
    d[info.from] -= 2 * V
    d[info.winner] += 2 * V
  }
  return d
}

export const hongkong: RuleSet = {
  id: 'hk',
  name: 'Hong Kong',
  zh: '香港麻雀',
  blurb: '13 tiles · 8 flowers · 3-fan minimum · fan doubling table',
  handSize: 13,
  nSets: 4,
  flowers: true,
  deadWall: 14,
  startPoints: 1000,
  unit: 'pts',
  specials: { kokushi: true },
  evaluate,
  settle,
}
