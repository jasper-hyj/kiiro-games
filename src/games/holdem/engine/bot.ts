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
  if (a === b)
    s = 0.5 + (a / 12) * 0.5 // pairs: 22 = .5, AA = 1
  else {
    s = ((a * 0.6 + b * 0.4) / 12) * 0.62 // high cards
    if (suited) s += 0.06
    if (gap === 1) s += 0.05
    else if (gap === 2) s += 0.03
    else if (gap >= 4) s -= 0.04
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
  const run = ranks.reduce((m, r, i) => {
    let k = 1
    while (ranks.includes(r + k)) k++
    return Math.max(m, i >= 0 ? k : 0)
  }, 0)
  return 0.12 + (flushDraw ? 0.16 : 0) + (run >= 4 ? 0.1 : 0)
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step

/**
 * A bot's style, fixed for the whole session so the table can learn it (and be fooled by it):
 * loose = plays more hands and calls lighter, aggro = bets and raises more, bluff = how often it bets with nothing,
 * trap = how often it slow-plays a strong hand (check or call now, spring the raise later), steady = how little its mood swings.
 * All between 0 and 1.
 */
export interface Persona {
  name: string
  loose: number
  aggro: number
  bluff: number
  trap: number
  steady: number
}
export const NEUTRAL: Persona = { name: 'balanced', loose: 0.5, aggro: 0.5, bluff: 0.5, trap: 0.4, steady: 0.5 }
/** A stable personality for a seat, picked from its id (so a refresh keeps the same bot). */
export function personaFor(id: string): Persona {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    h ^= h >>> 13
    return (h >>> 0) / 4294967296
  }
  const loose = next(),
    aggro = next(),
    bluff = next(),
    trap = next(),
    steady = next()
  const name =
    aggro > 0.66
      ? loose > 0.5
        ? 'maniac'
        : 'aggressive'
      : aggro < 0.34
        ? loose > 0.5
          ? 'calling station'
          : 'rock'
        : loose > 0.6
          ? 'loose'
          : loose < 0.35
            ? 'tight'
            : 'balanced'
  return { name, loose, aggro, bluff, trap, steady }
}

/** Flush and straight draws on the flop or turn: 0 (none) to about 0.5 (both). */
export function drawStrength(hole: number[], board: number[]): number {
  if (board.length < 3 || board.length > 4) return 0
  const all = [...hole, ...board]
  const suits = all.map(suitOf)
  const flushDraw = [0, 1, 2, 3].some((s) => suits.filter((x) => x === s).length === 4 && hole.some((c) => suitOf(c) === s))
  const ranks = [...new Set(all.map(rankOf))]
  if (ranks.includes(12)) ranks.push(-1) // an ace also plays low
  const set = new Set(ranks)
  let open = false
  for (let lo = -1; lo <= 8; lo++) {
    const n = [0, 1, 2, 3, 4].filter((k) => set.has(lo + k)).length
    if (n >= 4) open = true
  }
  return (flushDraw ? 0.3 : 0) + (open ? 0.22 : 0)
}

/** What this bot does with the view it was given (it must be its turn). `rng` is injectable so tests can be deterministic. */
export function botDecision(v: PokerView, rng: () => number = Math.random, p: Persona = NEUTRAL): PokerAct {
  const me = v.seats[v.you]
  const t = v.turn
  if (!t || !me) return { a: 'fold' }
  const bb = v.config.bb
  const pot = v.pot
  const hole = me.hole ?? []
  const pre = v.street === 'preflop'
  const river = v.street === 'river'
  const s = pre ? preflopStrength(hole) : madeStrength(hole, v.board)
  const draw = pre ? 0 : drawStrength(hole, v.board)
  const price = t.call > 0 ? t.call / (pot + t.call) : 0 // the share of the final pot I must pay to continue
  // a mood that drifts hand to hand: steady players barely move, others play some hands too well and some too badly
  const mood = 1 + (rng() - 0.5) * (0.5 - p.steady * 0.36)
  const strength = Math.min(1, s * mood)
  const opponents = v.seats.filter((x) => !x.empty && !x.folded && x !== me).length
  const aggro = 0.55 + p.aggro * 0.9 // 0.55 ... 1.45: scales every betting frequency
  const sizes = [0.33, 0.5, 0.66, 0.75, 1, 1.25]

  const raiseTo = (frac: number) => {
    const target = roundTo(v.seats.reduce((m, x) => Math.max(m, x.bet), 0) + Math.max(bb, pot * frac), Math.max(5, bb / 2))
    return Math.min(t.maxRaiseTo, Math.max(t.minRaiseTo, target))
  }
  const raise = (frac: number): PokerAct => {
    const to = raiseTo(frac)
    return to >= t.maxRaiseTo ? { a: 'allin' } : { a: 'raise', to }
  }
  /** a bet size a person would pick: small for thin value or a probe, big for the nuts or a big bluff */
  const size = (strong: boolean) => (strong ? sizes[2 + Math.floor(rng() * 4)] : sizes[Math.floor(rng() * 4)])

  const strongHand = strength > 0.78
  // slow-play: a monster on the flop or turn is sometimes checked or just called, to let others catch up (never on the river, never against a crowd)
  const trapping = strongHand && !pre && !river && opponents <= 2 && rng() < p.trap * 0.8

  if (t.call === 0) {
    // nothing to pay
    if (trapping) return { a: 'check' }
    if (t.canRaise && strength > (pre ? 0.72 - p.loose * 0.1 : 0.62 - p.loose * 0.06) && rng() < Math.min(0.95, 0.55 + p.aggro * 0.4))
      return raise(size(strongHand))
    if (t.canRaise && strength > (pre ? 0.55 : 0.45) && rng() < 0.3 * aggro) return raise(size(false))
    // semi-bluff: a draw bets sometimes, with a bigger bet when it has outs to fall back on
    if (t.canRaise && draw >= 0.22 && rng() < 0.45 * aggro) return raise(size(draw > 0.4))
    // pure bluff: more likely heads-up and when the board is cold, never with a hand worth showing down
    if (t.canRaise && !pre && strength < 0.3 && draw < 0.22 && rng() < 0.06 * (0.4 + p.bluff * 1.6) * (opponents <= 1 ? 1.6 : 0.6))
      return raise(size(rng() < 0.5))
    // blind steal from the late seats with nothing
    if (pre && t.canRaise && strength < 0.4 && rng() < 0.05 * (0.4 + p.bluff * 1.2) && opponents <= 3) return raise(0.8)
    return { a: 'check' }
  }

  // a bet to face: compare my strength (and my draw) to the price
  const big = t.call >= me.stack * 0.6 // facing most of my chips
  const equity = Math.max(strength, strength + draw * 0.6)
  const need = price * 1.35 + (big ? 0.2 : 0.08) - (pre && t.call <= bb ? 0.1 : 0) - (p.loose - 0.5) * 0.18
  // a trap springs: raise big over a bet with a monster, or just call to keep the bettor in
  if (strongHand && t.canRaise && !big) {
    if (trapping && rng() < 0.5) return { a: 'call' } // keep slow-playing; the raise comes on a later street
    if (strength > 0.84 && rng() < 0.7 * Math.min(1.2, aggro)) return raise(0.7 + rng() * 0.6)
  }
  if (equity > need) {
    // a good price but no more than a call: sometimes float, sometimes raise as a bluff-raise with a draw
    if (draw >= 0.3 && strength < 0.5 && t.canRaise && !big && rng() < 0.12 * aggro) return raise(0.8)
    return t.call >= t.maxRaiseTo && t.maxRaiseTo > 0 ? { a: 'allin' } : { a: 'call' }
  }
  if (t.call <= bb && pre && strength > 0.3 - p.loose * 0.1) return { a: 'call' } // a cheap look at the flop
  // a human sometimes calls out of curiosity (a hero call), more so the looser they are, never for most of the stack
  if (!big && !pre && strength > 0.2 && rng() < 0.05 + p.loose * 0.08) return { a: 'call' }
  if (strength < 0.25 && !big && t.canRaise && rng() < 0.05 * (0.4 + p.bluff * 1.4)) return raise(0.6) // a rare bluff-raise
  return { a: 'fold' }
}
