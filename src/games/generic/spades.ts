import { TurnGame, type GameMeta, type Outcome } from './base'
import { rankOf, shuffled, suitOf } from '../holdem/engine/cards'

/**
 * Spades for four in two partnerships (seats 1 and 3 against seats 2 and 4). One deal per game. Everyone bids the number of tricks they expect
 * (0 = "nil": take none); spades are trump and cannot lead until a spade has been played. A team that makes its combined bid scores 10 per
 * trick bid plus 1 for each extra trick; a team that falls short loses 10 per trick bid. A successful nil is worth 100, a failed one costs 100.
 */
export const SPADES_META: GameMeta = {
  kind: 'spades', minPlayers: 4, maxPlayers: 4, variable: false, chipUnit: 5,
  fields: [],
  defaults: { ranked: false },
}
const SPADE = 0, ACE = 12, KING = 11, QUEEN = 10
const order = (a: number, b: number) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b)

interface State {
  hands: number[][]; phase: 'bid' | 'play' | 'done'; bids: (number | null)[]; turn: number; lead: number; trick: { seat: number; card: number }[]
  won: number[]; broken: boolean; tricks: number; last: { seat: number; card: number }[] | null; lastWinner: number; team: [number, number]; detail: { team: number; bid: number; made: number; score: number; nil: number }[]
}

export class Spades extends TurnGame {
  readonly meta = SPADES_META
  private s: State = { hands: [], phase: 'bid', bids: [], turn: 0, lead: 0, trick: [], won: [], broken: false, tricks: 0, last: null, lastWinner: -1, team: [0, 0], detail: [] }

  protected begin() {
    const d = shuffled()
    const hands = [0, 1, 2, 3].map((i) => d.slice(i * 13, i * 13 + 13).sort(order))
    const first = (this.gameNo - 1) % 4
    this.s = { hands, phase: 'bid', bids: [null, null, null, null], turn: first, lead: first, trick: [], won: [0, 0, 0, 0], broken: false, tricks: 0, last: null, lastWinner: -1, team: [0, 0], detail: [] }
  }
  turn() { return this.status === 'playing' && this.s.phase !== 'done' ? this.s.turn : -1 }

  // ---- bidding ----
  private doBid(seat: number, bid: number) {
    this.s.bids[seat] = bid
    if (this.s.bids.every((b) => b !== null)) { this.s.phase = 'play'; this.s.turn = this.s.lead; return }
    this.s.turn = (seat + 1) % 4
  }
  private guess(hand: number[]): number {
    let t = 0
    const bySuit = [0, 1, 2, 3].map((su) => hand.filter((c) => suitOf(c) === su))
    for (const c of bySuit[SPADE]) { const r = rankOf(c); if (r === ACE) t += 1; else if (r === KING && bySuit[SPADE].length >= 2) t += 0.9; else if (r === QUEEN && bySuit[SPADE].length >= 3) t += 0.7 }
    if (bySuit[SPADE].length > 3) t += (bySuit[SPADE].length - 3) * 0.8
    for (let su = 1; su < 4; su++) {
      const h = bySuit[su]
      if (h.some((c) => rankOf(c) === ACE)) t += 0.9
      if (h.some((c) => rankOf(c) === KING) && h.length >= 2) t += 0.6
      if (h.length <= 1 && bySuit[SPADE].length >= 3) t += h.length === 0 ? 0.8 : 0.4 // short suit: can ruff
    }
    return t
  }
  // ---- play ----
  legal(seat: number): number[] {
    const hand = this.s.hands[seat]
    if (this.s.trick.length === 0) {
      if (this.s.broken) return hand
      const free = hand.filter((c) => suitOf(c) !== SPADE)
      return free.length ? free : hand
    }
    const lead = suitOf(this.s.trick[0].card)
    const follow = hand.filter((c) => suitOf(c) === lead)
    return follow.length ? follow : hand
  }
  protected act(seat: number, m: any): string | null {
    if (this.s.phase === 'bid') {
      const b = Number(m?.bid)
      if (!Number.isInteger(b) || b < 0 || b > 13) return 'bad_bid'
      this.doBid(seat, b); return null
    }
    const c = Number(m?.card)
    if (!this.legal(seat).includes(c)) return 'bad_card'
    this.playCard(seat, c); return null
  }
  private winnerOf(trick: { seat: number; card: number }[]) {
    const lead = suitOf(trick[0].card)
    const beats = (a: number, b: number) => { // does b beat a?
      const sa = suitOf(a), sb = suitOf(b)
      if (sb === SPADE && sa !== SPADE) return true
      if (sb === sa) return rankOf(b) > rankOf(a)
      return false
    }
    void lead
    return trick.reduce((a, b) => (beats(a.card, b.card) ? b : a))
  }
  private playCard(seat: number, c: number) {
    const h = this.s.hands[seat]; h.splice(h.indexOf(c), 1)
    this.s.trick.push({ seat, card: c })
    if (suitOf(c) === SPADE) this.s.broken = true
    if (this.s.trick.length < 4) { this.s.turn = (seat + 1) % 4; return }
    const win = this.winnerOf(this.s.trick)
    this.s.won[win.seat]++
    this.s.last = this.s.trick; this.s.lastWinner = win.seat
    this.s.trick = []; this.s.tricks++
    if (this.s.tricks === 13) { this.settle(); return }
    this.s.turn = win.seat; this.s.lead = win.seat
  }
  private settle() {
    this.s.phase = 'done'
    const detail: State['detail'] = []
    for (const team of [0, 1]) {
      const members = [team, team + 2]
      const real = members.filter((m) => this.s.bids[m]! > 0)
      const bid = real.reduce((a, m) => a + this.s.bids[m]!, 0)
      const made = real.reduce((a, m) => a + this.s.won[m], 0)
      let score = bid > 0 ? (made >= bid ? bid * 10 + (made - bid) : -bid * 10) : 0
      let nil = 0
      for (const m of members) if (this.s.bids[m] === 0) { nil += this.s.won[m] === 0 ? 100 : -100 }
      score += nil
      detail.push({ team, bid, made, score, nil })
    }
    this.s.detail = detail
    this.s.team = [detail[0].score, detail[1].score]
  }

  // ---- the bot ----
  protected bot(seat: number) {
    const hand = this.s.hands[seat]
    if (this.s.phase === 'bid') {
      const t = this.guess(hand)
      const partner = this.s.bids[(seat + 2) % 4]
      let bid = Math.max(1, Math.min(9, Math.round(t)))
      if (t < 1.1 && hand.filter((c) => suitOf(c) === SPADE && rankOf(c) > 7).length === 0 && (partner === null || partner > 0) && Math.random() < 0.7) bid = 0 // a very weak hand goes nil
      return this.doBid(seat, bid)
    }
    this.playCard(seat, this.choose(seat, this.legal(seat)))
  }
  private choose(seat: number, ok: number[]): number {
    if (ok.length === 1) return ok[0]
    const lowest = (a: number[]) => a.reduce((x, y) => (rankOf(y) < rankOf(x) ? y : x))
    const highest = (a: number[]) => a.reduce((x, y) => (rankOf(y) > rankOf(x) ? y : x))
    const nil = this.s.bids[seat] === 0
    const partnerNil = this.s.bids[(seat + 2) % 4] === 0
    const trick = this.s.trick
    if (trick.length === 0) {
      if (nil) return lowest(ok)
      const aces = ok.filter((c) => rankOf(c) === ACE && suitOf(c) !== SPADE)
      if (aces.length && !partnerNil) return aces[0]
      const side = ok.filter((c) => suitOf(c) !== SPADE)
      return lowest(side.length ? side : ok)
    }
    const lead = suitOf(trick[0].card)
    const win = this.winnerOf(trick)
    const partnerWinning = win.seat === (seat + 2) % 4
    const beat = (c: number) => { const w = win.card; return suitOf(c) === SPADE && suitOf(w) !== SPADE ? true : suitOf(c) === suitOf(w) && rankOf(c) > rankOf(w) }
    const winners = ok.filter(beat)
    if (nil) { // stay under the winning card, as high as possible; never win
      const under = ok.filter((c) => !beat(c))
      return under.length ? highest(under) : lowest(ok)
    }
    if (partnerNil && !partnerWinning && winners.length) return lowest(winners) // cover the partner's nil
    if (partnerWinning && trick.length === 3) return lowest(ok)
    if (partnerWinning && !partnerNil && rankOf(win.card) >= 10) return lowest(ok)
    if (winners.length) return lowest(winners)
    void lead
    return lowest(ok)
  }

  protected gameView(seat: number) {
    const s = this.s
    return {
      phase: s.phase, hand: seat >= 0 ? s.hands[seat] : [], counts: s.hands.map((h) => h.length), bids: s.bids, trick: s.trick, lead: s.lead, last: s.last, lastWinner: s.lastWinner, broken: s.broken, won: s.won, tricks: s.tricks,
      legal: seat >= 0 && s.phase === 'play' && s.turn === seat ? this.legal(seat) : [], team: s.team, detail: s.detail,
    }
  }
  protected outcome(): Outcome | null {
    if (this.s.phase !== 'done') return null
    const [a, b] = this.s.team
    const points = [(a - b) / 2, (b - a) / 2, (a - b) / 2, (b - a) / 2]
    return { points, winner: a === b ? -1 : a > b ? 0 : 1, summary: { team: this.s.team, detail: this.s.detail } }
  }
  protected saveState() { return this.s }
  protected loadState(s: State) { this.s = s }
}
