import { TurnGame, type GameMeta, type Outcome } from './base'

/**
 * Dou Dizhu (Fight the Landlord), 3 players, 54 cards. Players bid (1 to 3) for the right to be the landlord, who takes the three extra cards and plays alone
 * against the two farmers. Card order: 3 4 5 6 7 8 9 10 J Q K A 2, small joker, big joker. Plays: single, pair, triple (with one card or a pair),
 * straight (5+ singles), pair straight (3+ pairs), plane (2+ triples in a row, with or without wings), four with two cards, bomb (four alike), rocket (both jokers).
 * Bombs and rockets double the stake. The first to empty their hand ends the round: the landlord wins or loses against both farmers.
 */
export const DD_META: GameMeta = {
  kind: 'doudizhu',
  minPlayers: 3,
  maxPlayers: 3,
  variable: false,
  chipUnit: 100,
  fields: [],
  defaults: { ranked: false },
}
/** card ids 0..51 = suit * 13 + rank (rank 0 = 3 ... 11 = A, 12 = 2); 52 small joker, 53 big joker. */
export const rankOf = (c: number) => (c === 52 ? 13 : c === 53 ? 14 : c % 13)
export type Type =
  'single' | 'pair' | 'triple' | 'triple1' | 'triple2' | 'straight' | 'pairs' | 'plane' | 'plane1' | 'plane2' | 'four2' | 'four22' | 'bomb' | 'rocket'
export interface Combo {
  type: Type
  len: number
  rank: number
  cards: number[]
}

const tally = (cards: number[]) => {
  const c = new Map<number, number[]>()
  for (const x of cards) {
    const r = rankOf(x)
    ;(c.get(r) ?? c.set(r, []).get(r)!).push(x)
  }
  return c
}
const run = (ranks: number[]) => ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1) && ranks[ranks.length - 1] <= 11 // no 2 or joker in a run

/** what kind of play these cards are (null when they are not a legal play) */
export function classify(cards: number[]): Combo | null {
  const n = cards.length
  if (n === 0) return null
  const t = tally(cards)
  const counts = [...t.entries()].sort((a, b) => a[0] - b[0])
  const by = (k: number) => counts.filter(([, v]) => v.length === k).map(([r]) => r)
  const mk = (type: Type, rank: number, len = n): Combo => ({ type, len, rank, cards: [...cards].sort((a, b) => rankOf(a) - rankOf(b) || a - b) })
  if (n === 1) return mk('single', rankOf(cards[0]))
  if (n === 2) {
    if (t.size === 1) return mk('pair', counts[0][0])
    if (t.has(13) && t.has(14)) return mk('rocket', 14)
    return null
  }
  if (n === 3) return t.size === 1 ? mk('triple', counts[0][0]) : null
  if (n === 4) {
    if (t.size === 1) return mk('bomb', counts[0][0])
    if (t.size === 2 && by(3).length === 1) return mk('triple1', by(3)[0])
    return null
  }
  if (n === 5 && t.size === 2 && by(3).length === 1 && by(2).length === 1) return mk('triple2', by(3)[0])
  // straights: five or more different ranks in a row
  if (n >= 5 && counts.every(([, v]) => v.length === 1) && run(counts.map(([r]) => r))) return mk('straight', counts[counts.length - 1][0])
  // pair straights: three or more pairs in a row
  if (n >= 6 && n % 2 === 0 && counts.every(([, v]) => v.length === 2) && run(counts.map(([r]) => r))) return mk('pairs', counts[counts.length - 1][0], n / 2)
  // four with two single cards (or a pair) / four with two pairs
  if (n === 6 && by(4).length === 1) return mk('four2', by(4)[0])
  if (n === 8 && by(4).length === 1 && by(2).length === 2 && counts.length === 3) return mk('four22', by(4)[0])
  // planes: consecutive triples, with nothing, one card each, or a pair each
  const triples = counts.filter(([r, v]) => v.length >= 3 && r <= 11).map(([r]) => r)
  for (const k of [Math.floor(n / 3), Math.floor(n / 4), Math.floor(n / 5)]) {
    if (k < 2) continue
    for (let hi = triples.length - 1; hi >= k - 1; hi--) {
      const seq = triples.slice(hi - k + 1, hi + 1)
      if (!run(seq)) continue
      const rest = n - 3 * k
      if (rest === 0) return mk('plane', seq[k - 1], k)
      if (rest === k) return mk('plane1', seq[k - 1], k)
      if (rest === 2 * k) {
        // wings must be k pairs
        const left = new Map(counts.map(([r, v]) => [r, v.length - (seq.includes(r) ? 3 : 0)]))
        if ([...left.values()].every((x) => x === 0 || x === 2 || x === 4)) return mk('plane2', seq[k - 1], k)
      }
    }
  }
  return null
}
/** does `play` beat `last` (null: it leads)? */
export function beats(play: Combo, last: Combo | null): boolean {
  if (!last) return true
  if (last.type === 'rocket') return false
  if (play.type === 'rocket') return true
  if (play.type === 'bomb') return last.type !== 'bomb' || play.rank > last.rank
  if (last.type === 'bomb') return false
  return play.type === last.type && play.len === last.len && play.rank > last.rank
}

/** every way to answer `last` from `hand`, the weakest first (leading when last is null gives a sensible set of leads) */
export function options(hand: number[], last: Combo | null): Combo[] {
  const t = tally(hand)
  const ranks = [...t.keys()].sort((a, b) => a - b)
  const out: Combo[] = []
  const take = (r: number, k: number) => t.get(r)!.slice(0, k)
  const kickers = (exclude: number[], k: number, size: 1 | 2): number[] | null => {
    const pool = ranks.filter((r) => !exclude.includes(r) && t.get(r)!.length >= size).sort((a, b) => t.get(a)!.length - t.get(b)!.length || a - b)
    const pick: number[] = []
    for (const r of pool) {
      if (pick.length >= k * size) break
      pick.push(...take(r, size))
    }
    return pick.length === k * size ? pick : null
  }
  const push = (cards: number[]) => {
    const c = classify(cards)
    if (c && beats(c, last)) out.push(c)
  }
  const want = (type: Type) => !last || last.type === type
  if (want('single')) for (const r of ranks) if (!last || r > last.rank) push(take(r, 1))
  if (want('pair')) for (const r of ranks) if (t.get(r)!.length >= 2 && (!last || r > last.rank)) push(take(r, 2))
  for (const [ty, size] of [
    ['triple', 0],
    ['triple1', 1],
    ['triple2', 2],
  ] as [Type, number][]) {
    if (!want(ty)) continue
    for (const r of ranks)
      if (t.get(r)!.length >= 3 && r <= 12 && (!last || r > last.rank)) {
        if (size === 0) push(take(r, 3))
        else {
          const k = kickers([r], 1, size as 1 | 2)
          if (k) push([...take(r, 3), ...k])
        }
      }
  }
  if (want('straight')) {
    const len = last ? last.len : 0
    for (let lo = 0; lo <= 11; lo++)
      for (let L = len || 5; L <= (len || 12); L++) {
        const seq = Array.from({ length: L }, (_, i) => lo + i)
        if (seq[L - 1] <= 11 && seq.every((r) => t.has(r))) push(seq.map((r) => take(r, 1)[0]))
      }
  }
  if (want('pairs')) {
    const len = last ? last.len : 0
    for (let lo = 0; lo <= 11; lo++)
      for (let L = len || 3; L <= (len || 10); L++) {
        const seq = Array.from({ length: L }, (_, i) => lo + i)
        if (seq[L - 1] <= 11 && seq.every((r) => (t.get(r)?.length ?? 0) >= 2)) push(seq.flatMap((r) => take(r, 2)))
      }
  }
  for (const [ty, size] of [
    ['plane', 0],
    ['plane1', 1],
    ['plane2', 2],
  ] as [Type, number][]) {
    if (!want(ty)) continue
    const len = last ? last.len : 0
    for (let lo = 0; lo <= 11; lo++)
      for (let L = len || 2; L <= (len || 6); L++) {
        const seq = Array.from({ length: L }, (_, i) => lo + i)
        if (seq[L - 1] > 11 || !seq.every((r) => (t.get(r)?.length ?? 0) >= 3)) continue
        const base = seq.flatMap((r) => take(r, 3))
        if (size === 0) push(base)
        else {
          const k = kickers(seq, L, size as 1 | 2)
          if (k) push([...base, ...k])
        }
      }
  }
  if (want('four2'))
    for (const r of ranks)
      if (t.get(r)!.length === 4 && (!last || r > last.rank)) {
        const k = kickers([r], 2, 1)
        if (k) push([...take(r, 4), ...k])
      }
  if (want('four22'))
    for (const r of ranks)
      if (t.get(r)!.length === 4 && (!last || r > last.rank)) {
        const k = kickers([r], 2, 2)
        if (k) push([...take(r, 4), ...k])
      }
  const bombs = ranks.filter((r) => t.get(r)!.length === 4 && (!last || last.type !== 'bomb' || r > last.rank))
  if (last && last.type !== 'rocket') for (const r of bombs) push(take(r, 4))
  if (last && t.has(13) && t.has(14)) push([52, 53])
  return out.sort(
    (a, b) =>
      (a.type === 'rocket' ? 2 : a.type === 'bomb' ? 1 : 0) - (b.type === 'rocket' ? 2 : b.type === 'bomb' ? 1 : 0) ||
      a.rank - b.rank ||
      a.cards.length - b.cards.length,
  )
}

interface State {
  phase: 'bid' | 'play'
  hands: number[][]
  bottom: number[]
  landlord: number
  bids: (number | null)[]
  bidder: number
  high: number
  highSeat: number
  redeals: number
  turn: number
  last: { seat: number; combo: Combo } | null
  passes: number
  played: number[]
  bombs: number
  recent: ({ cards: number[] } | 'pass' | null)[]
  winner: number
  first: number
}
export class DouDizhu extends TurnGame {
  readonly meta = DD_META
  private s: State = {
    phase: 'bid',
    hands: [],
    bottom: [],
    landlord: -1,
    bids: [],
    bidder: 0,
    high: 0,
    highSeat: -1,
    redeals: 0,
    turn: 0,
    last: null,
    passes: 0,
    played: [],
    bombs: 0,
    recent: [],
    winner: -1,
    first: 0,
  }

  protected begin() {
    this.deal((this.gameNo - 1) % 3, 0)
  }
  private deal(first: number, redeals: number) {
    const deck = Array.from({ length: 54 }, (_, i) => i)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    const hands = [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)]
    this.s = {
      phase: 'bid',
      hands,
      bottom: deck.slice(51),
      landlord: -1,
      bids: [null, null, null],
      bidder: first,
      high: 0,
      highSeat: -1,
      redeals,
      turn: first,
      last: null,
      passes: 0,
      played: [0, 0, 0],
      bombs: 0,
      recent: [null, null, null],
      winner: -1,
      first,
    }
  }
  turn() {
    return this.status === 'playing' && this.s.winner < 0 ? this.s.turn : -1
  }

  private startPlay(landlord: number) {
    const s = this.s
    s.landlord = landlord
    s.hands[landlord].push(...s.bottom)
    s.phase = 'play'
    s.turn = landlord
    s.last = null
    s.passes = 0
  }
  protected act(seat: number, m: any): string | null {
    const s = this.s
    if (s.phase === 'bid') {
      const bid = Number(m?.bid)
      if (![0, 1, 2, 3].includes(bid)) return 'bad_bid'
      if (bid !== 0 && bid <= s.high) return 'bid_higher'
      s.bids[seat] = bid
      if (bid > 0) {
        s.high = bid
        s.highSeat = seat
      }
      const done = bid === 3 || s.bids.every((b) => b !== null)
      if (done) {
        if (s.highSeat < 0) {
          // everybody passed: a new deal (after two tries the first bidder simply becomes the landlord)
          if (s.redeals >= 2) {
            s.high = 1
            this.startPlay(s.first)
          } else this.deal((s.first + 1) % 3, s.redeals + 1)
        } else this.startPlay(s.highSeat)
      } else s.turn = (seat + 1) % 3
      return null
    }
    if (m?.pass) {
      if (!s.last) return 'must_lead'
      s.recent[seat] = 'pass'
      s.passes++
      if (s.passes >= 2) {
        s.last = null
        s.passes = 0
        s.recent = [null, null, null].map((_, i) => (i === seat ? 'pass' : null))
      }
      s.turn = (seat + 1) % 3
      return null
    }
    const cards: number[] = Array.isArray(m?.cards) ? m.cards.map(Number) : []
    if (!cards.length || new Set(cards).size !== cards.length || !cards.every((c) => s.hands[seat].includes(c))) return 'not_in_hand'
    const combo = classify(cards)
    if (!combo) return 'bad_combo'
    if (!beats(combo, s.last?.combo ?? null)) return s.last ? 'too_low' : 'bad_combo'
    s.hands[seat] = s.hands[seat].filter((c) => !cards.includes(c))
    if (combo.type === 'bomb' || combo.type === 'rocket') s.bombs++
    if (!s.last) s.recent = [null, null, null]
    s.recent[seat] = { cards: combo.cards }
    s.last = { seat, combo }
    s.passes = 0
    s.played[seat]++
    if (s.hands[seat].length === 0) {
      s.winner = seat
      return null
    }
    s.turn = (seat + 1) % 3
    return null
  }

  protected bot(seat: number) {
    const s = this.s
    if (s.phase === 'bid') {
      const h = s.hands[seat]
      const t = tally(h)
      let power = (t.has(14) ? 3 : 0) + (t.has(13) ? 2 : 0) + (t.get(12)?.length ?? 0) * 1.5 + (t.get(11)?.length ?? 0) * 0.6
      for (const [, v] of t) if (v.length === 4) power += 2.5
      const want = power >= 7 ? 3 : power >= 5 ? 2 : power >= 3.2 ? 1 : 0
      this.act(seat, { bid: want > s.high ? want : 0 })
      return
    }
    const hand = s.hands[seat]
    const mateLeads = s.last && s.last.seat !== seat && s.last.seat !== s.landlord && seat !== s.landlord // a farmer's partner is winning this trick
    const opts = options(hand, s.last?.combo ?? null)
    const enemyLow = (seat === s.landlord ? [0, 1, 2].filter((i) => i !== seat) : [s.landlord]).some((i) => s.hands[i].length <= 2)
    if (!s.last) {
      // lead: the weakest group, preferring plays that use up more cards; keep 2s, jokers and bombs for later
      const leads = options(hand, null).filter((c) => c.type !== 'bomb' && c.type !== 'rocket')
      const pool = leads.filter((c) => c.rank <= 10 || hand.length <= 6)
      const pick = (pool.length ? pool : leads).sort((a, b) => b.cards.length - a.cards.length + (a.rank - b.rank) * 0.7)[0]
      const cards = pick ? pick.cards : (options(hand, null)[0]?.cards ?? [hand[0]])
      this.act(seat, { cards })
      return
    }
    const cheap = opts.filter((c) => c.type !== 'bomb' && c.type !== 'rocket')
    if (mateLeads && hand.length > 3 && !enemyLow) return void this.act(seat, { pass: true }) // let the partner's play stand
    const pick = cheap[0] ?? (enemyLow || hand.length <= 5 || Math.random() < 0.15 ? opts[0] : undefined)
    if (pick) this.act(seat, { cards: pick.cards })
    else this.act(seat, { pass: true })
  }

  protected gameView(seat: number) {
    const s = this.s
    const over = s.winner >= 0
    const hint = seat >= 0 && seat === s.turn && s.phase === 'play' ? (options(s.hands[seat], s.last?.combo ?? null)[0]?.cards ?? []) : []
    return {
      phase: s.phase,
      hand: seat >= 0 ? [...s.hands[seat]].sort((a, b) => rankOf(b) - rankOf(a) || a - b) : [],
      counts: s.hands.map((h) => h.length),
      landlord: s.landlord,
      bottom: s.phase === 'play' ? s.bottom : [],
      bids: s.bids,
      high: s.high,
      last: s.last ? { seat: s.last.seat, cards: s.last.combo.cards, type: s.last.combo.type } : null,
      recent: s.recent,
      bombs: s.bombs,
      hint,
      winner: s.winner,
      hands: over ? s.hands : null,
    }
  }
  protected outcome(): Outcome | null {
    const s = this.s
    if (s.winner < 0) return null
    const landlordWins = s.winner === s.landlord
    const spring = landlordWins ? s.played.every((p, i) => i === s.landlord || p === 0) : s.played[s.landlord] === 1
    const unit = Math.max(1, s.high) * 2 ** (s.bombs + (spring ? 1 : 0))
    const points = [0, 1, 2].map((i) => (i === s.landlord ? (landlordWins ? 2 * unit : -2 * unit) : landlordWins ? -unit : unit))
    return { points, winner: s.winner, summary: { landlord: s.landlord, bid: s.high, bombs: s.bombs, spring } }
  }
  protected saveState() {
    return this.s
  }
  protected loadState(s: State) {
    this.s = s
  }
}
