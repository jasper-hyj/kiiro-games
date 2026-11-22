import { rankOf, suitOf } from './cards'

export const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush']
const B = 13

/** Score of exactly five cards: higher is better, equal means a split. Category in the top digit, tie-breaks below. */
export function score5(cs: number[]): number {
  const ranks = cs.map(rankOf).sort((a, b) => b - a)
  const flush = cs.every((c) => suitOf(c) === suitOf(cs[0]))
  const cnt = new Map<number, number>()
  for (const r of ranks) cnt.set(r, (cnt.get(r) ?? 0) + 1)
  // groups ordered by size then rank: the tie-break order
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const uniq = groups.length === 5
  let straightHigh = -1
  if (uniq) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0]
    else if (ranks[0] === 12 && ranks[1] === 3 && ranks[4] === 0) straightHigh = 3 // wheel A-2-3-4-5
  }
  let cat: number, tb: number[]
  if (straightHigh >= 0 && flush) { cat = 8; tb = [straightHigh] }
  else if (groups[0][1] === 4) { cat = 7; tb = groups.map((g) => g[0]) }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { cat = 6; tb = groups.map((g) => g[0]) }
  else if (flush) { cat = 5; tb = ranks }
  else if (straightHigh >= 0) { cat = 4; tb = [straightHigh] }
  else if (groups[0][1] === 3) { cat = 3; tb = groups.map((g) => g[0]) }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { cat = 2; tb = groups.map((g) => g[0]) }
  else if (groups[0][1] === 2) { cat = 1; tb = groups.map((g) => g[0]) }
  else { cat = 0; tb = ranks }
  let s = cat
  for (let i = 0; i < 5; i++) s = s * B + (tb[i] ?? 0)
  return s
}

/** Best five of up to seven cards. */
export function best(cards: number[]): number {
  if (cards.length <= 5) return score5(cards)
  let top = -1
  const n = cards.length
  // choose which (n - 5) cards to leave out
  const pick = (start: number, left: number, chosen: number[]) => {
    if (chosen.length === 5) { const s = score5(chosen); if (s > top) top = s; return }
    for (let i = start; i < n; i++) { if (n - i < 5 - chosen.length) break; chosen.push(cards[i]); pick(i + 1, left, chosen); chosen.pop() }
  }
  pick(0, 0, [])
  return top
}
export const categoryOf = (score: number) => Math.floor(score / B ** 5)
