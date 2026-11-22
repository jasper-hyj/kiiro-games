import { decompose, type Decomp, type SetInfo } from '../hand'
import type { Interp, MeldInfo, WinContext } from './types'
import { kindOf, numOf } from '../tiles'

export function meldSets(melds: MeldInfo[]): SetInfo[] {
  return melds.map((m) => {
    const k = kindOf(m.tiles[0])
    if (m.type === 'chi') return { type: 'seq', kind: Math.min(...m.tiles.map(kindOf)), open: true }
    const kan = m.type !== 'pon'
    return { type: 'tri', kind: k, open: m.type !== 'ankan', kan }
  })
}

function waitFor(set: SetInfo, win: number): Interp['waitKind'] {
  if (set.type === 'tri') return 'shanpon'
  const s = set.kind
  if (win === s + 1) return 'kanchan'
  if (win === s) return numOf(s) === 7 ? 'penchan' : 'ryanmen'
  return numOf(s) === 1 ? 'penchan' : 'ryanmen'
}

/** Every distinct way of reading the concealed part of a complete hand. */
export function interpretations(ctx: WinContext, nSets: number): Interp[] {
  const fixed = meldSets(ctx.melds)
  const out: Interp[] = []
  const decs: Decomp[] = decompose(ctx.counts, nSets - ctx.melds.length)
  for (const d of decs) {
    const seen = new Set<string>()
    const tryPlace = (idx: number, kind: Interp['waitKind']) => {
      const sets = d.sets.map((s) => ({ ...s, open: false }))
      if (idx >= 0 && !ctx.tsumo && sets[idx].type === 'tri') sets[idx].open = true
      out.push({ sets: [...fixed, ...sets], pair: d.pair, waitKind: kind, winSet: idx >= 0 ? idx + fixed.length : -1 })
    }
    d.sets.forEach((s, i) => {
      const inSet = s.type === 'tri' ? s.kind === ctx.winKind : ctx.winKind >= s.kind && ctx.winKind <= s.kind + 2
      if (!inSet) return
      const key = `${s.type}${s.kind}`
      if (seen.has(key)) return
      seen.add(key)
      tryPlace(i, waitFor(s, ctx.winKind))
    })
    if (d.pair === ctx.winKind) tryPlace(-1, 'tanki')
  }
  return out
}

export const closedHand = (ctx: WinContext) => ctx.melds.every((m) => m.type === 'ankan')
export const flowerSetBonus = (flowers: number[]) => {
  const plants = flowers.filter((k) => k < 38).length
  const seasons = flowers.filter((k) => k >= 38).length
  return (plants === 4 ? 1 : 0) + (seasons === 4 ? 1 : 0)
}
