import { rankOf, suitOf } from '../../holdem/engine/cards'

/** Big Two order: 3 is lowest, 2 is highest. Suits low to high: diamonds, clubs, hearts, spades (change SUIT_POWER to use another order). */
export const bRank = (c: number) => (rankOf(c) + 12) % 13 // 3 -> 0 ... A -> 11, 2 -> 12
const SUIT_POWER = [3, 2, 0, 1] // holdem suit index (spade, heart, diamond, club) -> power
export const bSuit = (c: number) => SUIT_POWER[suitOf(c)]
/** Single-card strength: higher beats lower. */
export const power = (c: number) => bRank(c) * 4 + bSuit(c)
/** The opening card: the 3 of diamonds. */
export const THREE_DIAMONDS = 2 * 13 + 1 // holdem id: suit 2 (diamonds), rank index 1 (the 3)

export type ComboType = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'fullhouse' | 'quads' | 'straightflush'
export interface Combo { type: ComboType; size: number; /** order within the type (and between five-card types: type rank first) */ key: number; cards: number[] }
const FIVE_RANK: Record<string, number> = { straight: 1, flush: 2, fullhouse: 3, quads: 4, straightflush: 5 }

/** Classify a set of cards as a legal play, or null. */
export function evalCombo(cards: number[]): Combo | null {
  const cs = [...cards].sort((a, b) => power(a) - power(b))
  const n = cs.length
  if (new Set(cs).size !== n) return null
  const ranks = cs.map(bRank)
  const top = power(cs[n - 1])
  if (n === 1) return { type: 'single', size: 1, key: top, cards: cs }
  if (n === 2) return ranks[0] === ranks[1] ? { type: 'pair', size: 2, key: top, cards: cs } : null
  if (n === 3) return ranks[0] === ranks[2] ? { type: 'triple', size: 3, key: top, cards: cs } : null
  if (n !== 5) return null
  const flush = cs.every((c) => bSuit(c) === bSuit(cs[0]))
  const straight = ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1) && ranks[4] <= 11 // no 2 in a straight
  const cnt = new Map<number, number>(); for (const r of ranks) cnt.set(r, (cnt.get(r) ?? 0) + 1)
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const mk = (type: ComboType, key: number): Combo => ({ type, size: 5, key: FIVE_RANK[type] * 1000 + key, cards: cs })
  if (straight && flush) return mk('straightflush', top)
  if (groups[0][1] === 4) return mk('quads', groups[0][0])
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return mk('fullhouse', groups[0][0])
  if (flush) return mk('flush', bSuit(cs[0]) * 100 + ranks[4] * 4 + 0) // suit first, then the highest rank
  if (straight) return mk('straight', top)
  return null
}

/** Does `play` beat `current`? (same number of cards, and a stronger combination) */
export function beats(play: Combo, current: Combo | null): boolean {
  if (!current) return true
  if (play.size !== current.size) return false
  return play.key > current.key
}

/** Every legal combination in a hand (used by the bot and for hints). */
export function allCombos(hand: number[]): Combo[] {
  const h = [...hand].sort((a, b) => power(a) - power(b))
  const out: Combo[] = []
  for (const c of h) out.push({ type: 'single', size: 1, key: power(c), cards: [c] })
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) {
    if (bRank(h[i]) === bRank(h[j])) out.push({ type: 'pair', size: 2, key: power(h[j]), cards: [h[i], h[j]] })
    for (let k = j + 1; k < h.length; k++) if (bRank(h[i]) === bRank(h[k])) out.push({ type: 'triple', size: 3, key: power(h[k]), cards: [h[i], h[j], h[k]] })
  }
  if (h.length >= 5) {
    const idx = h.map((_, i) => i)
    const pick = (start: number, chosen: number[]) => {
      if (chosen.length === 5) { const c = evalCombo(chosen.map((i) => h[i])); if (c) out.push(c); return }
      for (let i = start; i < idx.length; i++) { if (idx.length - i < 5 - chosen.length) break; chosen.push(i); pick(i + 1, chosen); chosen.pop() }
    }
    pick(0, [])
  }
  return out
}

/** Points paid by a player who still holds `left` cards when someone goes out. */
export const penalty = (left: number) => (left >= 13 ? 4 : left >= 10 ? 3 : left >= 8 ? 2 : left)
