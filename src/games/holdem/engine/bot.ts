import { best, categoryOf } from './eval'
import type { PokerAct, PokerView } from './table'
import { rankOf, suitOf } from './cards'

/**
 * A sensible, not-too-strong practice opponent. It plays the way a careful beginner-to-club player does:
 * it values its two cards before the flop, counts what it has after it, weighs the price of a call against the pot,
 * bets for value when strong, and now and then bluffs or slows down so it is not predictable.
 */

/** Strength of two hole cards from 0 to 1 (a pair of aces is 1, seven-two offsuit is near 0). */
export function preflopStrength(hole: number[]): number {
  const [a, b] = hole.map(rankOf).sort((x, y) => y - x) // 12 = ace ... 0 = two
  const suited = suitOf(hole[0]) === suitOf(hole[1])
  const gap = a - b
  let s: number
  if (a === b) s = 0.5 + (a / 12) * 0.5 // pairs: 22 = .5, AA = 1
  else {
    s = (a * 0.6 + b * 0.4) / 12 * 0.62 // high cards
    if (suited) s += 0.06
    if (gap === 1) s += 0.05; else if (gap === 2) s += 0.03; else if (gap >= 4) s -= 0.04
    if (a === 12) s += 0.1 // an ace is always worth something
  }
  return Math.max(0, Math.min(1, s))
}

/** How good the best five-card hand is after the flop: 0 (nothing) to 1 (the nuts territory). */
export function madeStrength(hole: number[], board: number[]): number {
  const cat = categoryOf(best([...hole, ...board]))
  // 0 high card, 1 pair, 2 two pair, 3 trips, 4 straight, 5 flush, 6 full house, 7 quads, 8 straight flush
  if (cat >= 4) return 0.85 + Math.min(0.15, (cat - 4) * 0.04)
  if (cat === 3) return 0.78
  if (cat === 2) return 0.7
  if (cat === 1) {
    // top pair is worth more than a low pair; a pair played from the board alone is weak
    const boardRanks = board.map(rankOf)
    const pairRank = [...hole.map(rankOf)].find((r) => boardRanks.includes(r))
    const usesHole = pairRank !== undefined || rankOf(hole[0]) === rankOf(hole[1])
    if (!usesHole) return 0.22
    const r = pairRank ?? rankOf(hole[0])
    return 0.42 + (r / 12) * 0.2 + (r >= Math.max(...boardRanks) ? 0.08 : 0)
  }
  // high card: some chance from a flush or straight draw
  const suits = [...hole, ...board].map(suitOf)
  const flushDraw = [0, 1, 2, 3].some((s) => suits.filter((x) => x === s).length === 4)
  const ranks = [...new Set([...hole, ...board].map(rankOf))].sort((x, y) => x - y)
  const run = ranks.reduce((m, r, i) => { let k = 1; while (ranks.includes(r + k)) k++; return Math.max(m, i >= 0 ? k : 0) }, 0)
  return 0.12 + (flushDraw ? 0.16 : 0) + (run >= 4 ? 0.1 : 0)
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step

/** What this bot does with the view it was given (it must be its turn). `rng` is injectable so tests can be deterministic. */
export function botDecision(v: PokerView, rng: () => number = Math.random): PokerAct {
  const me = v.seats[v.you]
  const t = v.turn
  if (!t || !me) return { a: 'fold' }
  const bb = v.config.bb
  const pot = v.pot
  const hole = me.hole ?? []
  const pre = v.street === 'preflop'
  const s = pre ? preflopStrength(hole) : madeStrength(hole, v.board)
  const price = t.call > 0 ? t.call / (pot + t.call) : 0 // the share of the final pot I must pay to continue
  const mood = 0.9 + rng() * 0.2 // a little randomness so it is not a machine
  const strength = s * mood

  const raiseTo = (frac: number) => {
    const target = roundTo(v.seats.reduce((m, x) => Math.max(m, x.bet), 0) + Math.max(bb, pot * frac), Math.max(5, bb / 2))
    return Math.min(t.maxRaiseTo, Math.max(t.minRaiseTo, target))
  }
  const raise = (frac: number): PokerAct => { const to = raiseTo(frac); return to >= t.maxRaiseTo ? { a: 'allin' } : { a: 'raise', to } }

  if (t.call === 0) {
    // nothing to pay: bet when strong, sometimes bluff a little, otherwise check
    if (t.canRaise && strength > (pre ? 0.72 : 0.62)) return raise(0.55 + rng() * 0.35)
    if (t.canRaise && strength > (pre ? 0.55 : 0.45) && rng() < 0.35) return raise(0.4)
    if (t.canRaise && strength < 0.3 && !pre && rng() < 0.07) return raise(0.5) // a bluff
    return { a: 'check' }
  }
  // a bet to face: compare my strength to the price
  const big = t.call >= me.stack * 0.6 // facing most of my chips
  const need = price * 1.35 + (big ? 0.2 : 0.08) - (pre && t.call <= bb ? 0.1 : 0)
  if (strength > 0.84 && t.canRaise && rng() < 0.7) return raise(0.7)
  if (strength > need) return t.call >= t.maxRaiseTo && t.maxRaiseTo > 0 ? { a: 'allin' } : { a: 'call' }
  if (t.call <= bb && pre && strength > 0.3) return { a: 'call' } // a cheap look at the flop
  if (strength < 0.25 && !big && rng() < 0.05 && t.canRaise) return raise(0.6) // a rare bluff-raise
  return { a: 'fold' }
}
