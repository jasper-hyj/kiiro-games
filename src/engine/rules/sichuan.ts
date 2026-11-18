import type { HandScore, RuleSet, WinContext, YakuItem } from './types'
import { closedHand, interpretations } from './common'
import { isChiitoiDup } from '../hand'
import { isTerminal, numOf, suitOf } from '../tiles'

/** Sichuan Mahjong ("Blood Battle"): 108 tiles (no honors, no flowers), no chi, every player gives up one suit and
 *  may not win while holding it. Any complete hand wins; fan add up and a win is worth 2^fan points (capped).
 *  Settlement is done by the game itself (several players can win in one hand), so `settle` is only a fallback. */
const DEFAULT_CAP = 4

const Y = (name: string, zh: string, value: number): YakuItem => ({ name, zh, value })

function evaluate(ctx: WinContext): HandScore | null {
  const kinds = ctx.allKinds.map((v, k) => (v ? k : -1)).filter((k) => k >= 0)
  if (kinds.some((k) => k >= 27)) return null
  if (ctx.voidSuit != null && kinds.some((k) => suitOf(k) === ctx.voidSuit)) return null
  const cap = ctx.options.cap ?? DEFAULT_CAP
  const suits = new Set(kinds.map(suitOf))
  const flush = suits.size === 1

  // shared extras: roots (four of a kind anywhere in the hand), self-draw, kong tricks, last tile
  const extras: YakuItem[] = []
  const roots = ctx.allKinds.reduce((a, v) => a + (v === 4 ? 1 : 0), 0)
  if (roots > 0) extras.push(Y(`Root ×${roots}`, `根 ×${roots}`, roots))
  if (ctx.tsumo) extras.push(Y('Self-draw', '自摸', 1))
  if (ctx.rinshan) extras.push(Y('Win on Kong', '槓上開花', 1))
  if (ctx.chankan) extras.push(Y('Robbing the Kong', '搶槓胡', 1))
  if (ctx.lastTile && ctx.tsumo && !ctx.rinshan) extras.push(Y('Last Tile Draw', '海底撈月', 1))
  if (ctx.lastTile && !ctx.tsumo) extras.push(Y('Last Discard', '海底炮', 1))
  if (ctx.firstTurn && ctx.tsumo) extras.push(ctx.dealer ? Y('Heavenly Hand', '天胡', cap) : Y('Earthly Hand', '地胡', cap))

  const cands: HandScore[] = []
  const done = (base: YakuItem[]) => {
    const yaku = [...base, ...extras]
    const total = yaku.reduce((a, y) => a + y.value, 0)
    const shown = Math.min(total, cap)
    cands.push({ yaku, total, base: 2 ** shown, label: total >= cap ? 'Limit' : undefined })
  }

  if (ctx.melds.length === 0 && isChiitoiDup(ctx.counts)) {
    done([Y('Seven Pairs', '七對', 2), ...(flush ? [Y('Pure Suit', '清一色', 2)] : [])])
  }
  for (const it of interpretations(ctx, 4)) {
    const y: YakuItem[] = []
    const tris = it.sets.filter((s) => s.type === 'tri')
    const seqs = it.sets.filter((s) => s.type === 'seq')
    if (flush) y.push(Y('Pure Suit', '清一色', 2))
    const allPungs = tris.length === 4
    if (allPungs) y.push(Y('All Pungs', '對對胡', 1))
    // every set and the pair contain a 1 or a 9
    const edge = (s: { type: string; kind: number }) => (s.type === 'tri' ? isTerminal(s.kind) : numOf(s.kind) === 1 || numOf(s.kind) === 7)
    if (seqs.length > 0 && it.sets.every(edge) && isTerminal(it.pair)) y.push(Y('Terminals in Every Set', '帶幺九', 2))
    // all pungs built only from 2, 5 and 8
    if (allPungs && [...tris.map((t) => t.kind), it.pair].every((k) => [2, 5, 8].includes(numOf(k)))) y.push(Y('Twos, Fives and Eights', '將對', 2))
    // four exposed sets and a lone tile waiting for its pair
    if (ctx.melds.length === 4 && it.waitKind === 'tanki') y.push(Y('Golden Hook', '金鉤釣', 1))
    if (y.length === 0) y.push(Y('Plain Hand', '平胡', 0))
    done(y)
  }
  if (!cands.length) return null
  void closedHand
  return cands.reduce((a, b) => (b.total > a.total ? b : a))
}

function settle(score: HandScore, info: { winner: number; from: number | null }): number[] {
  const d = [0, 0, 0, 0]
  const V = score.base
  if (info.from === null) { for (let p = 0; p < 4; p++) if (p !== info.winner) { d[p] -= V; d[info.winner] += V } }
  else { d[info.from] -= V; d[info.winner] += V }
  return d
}

export const sichuan: RuleSet = {
  id: 'sichuan', name: 'Sichuan', zh: '四川麻將',
  blurb: '108 tiles · pick a missing suit · no chi · play on after wins (Blood Battle)',
  handSize: 13, nSets: 4, flowers: false, deadWall: 0, startPoints: 0, unit: 'pts',
  specials: { chiitoi: true, chiitoiDup: true },
  evaluate, settle,
}
