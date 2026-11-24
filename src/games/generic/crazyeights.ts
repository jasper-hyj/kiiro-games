import { TurnGame, type GameMeta, type Outcome } from './base'
import { rankOf, shuffled, suitOf } from '../holdem/engine/cards'

/**
 * Crazy Eights, 2 to 4 players. Play a card that matches the top card's suit or rank; an 8 is wild and names the next suit.
 * Nothing to play: draw one card, play it if you can, otherwise pass. First to empty their hand wins and scores what the others still hold.
 * With "action cards" on: an Ace reverses the order (with two players it skips), a 2 makes the next player draw two, a Jack skips the next player.
 */
export const C8_META: GameMeta = {
  kind: 'crazyeights', minPlayers: 2, maxPlayers: 4, variable: true, chipUnit: 5,
  fields: [
    { key: 'players', label: 'c8Players', options: [[2, '2'], [3, '3'], [4, '4']] },
    { key: 'action', label: 'c8Action', options: [[false, 'c8Classic'], [true, 'c8Actions']] },
  ],
  defaults: { players: 4, action: false, ranked: false },
}
const EIGHT = 6, JACK = 9, ACE = 12, TWO = 0
const worth = (c: number) => (rankOf(c) === EIGHT ? 50 : rankOf(c) >= JACK && rankOf(c) <= 11 ? 10 : rankOf(c) === ACE ? 1 : rankOf(c) + 2)

interface State { deck: number[]; pile: number[]; hands: number[][]; turn: number; dir: 1 | -1; suit: number; drew: boolean; last: { seat: number; what: string; card?: number } | null; winner: number }

export class CrazyEights extends TurnGame {
  readonly meta = C8_META
  private s: State = { deck: [], pile: [], hands: [], turn: 0, dir: 1, suit: 0, drew: false, last: null, winner: -1 }
  private get n() { return this.seats.length }

  protected begin() {
    const deck = shuffled()
    const hands = Array.from({ length: this.n }, () => deck.splice(0, 7))
    let top = deck.pop()!
    while (rankOf(top) === EIGHT) { deck.unshift(top); top = deck.pop()! } // never open on an 8
    this.s = { deck, pile: [top], hands, turn: (this.gameNo - 1) % this.n, dir: 1, suit: suitOf(top), drew: false, last: null, winner: -1 }
  }
  turn() { return this.status === 'playing' && this.s.winner < 0 ? this.s.turn : -1 }
  private top() { return this.s.pile[this.s.pile.length - 1] }
  private canPlay(c: number) { return rankOf(c) === EIGHT || suitOf(c) === this.s.suit || rankOf(c) === rankOf(this.top()) }
  private playable(seat: number) { return this.s.hands[seat].filter((c) => this.canPlay(c)) }
  private next(from: number, steps = 1) { return (((from + this.s.dir * steps) % this.n) + this.n) % this.n }
  private drawOne(seat: number): number | null {
    if (this.s.deck.length === 0) { // turn the pile over, keeping the top card
      const keep = this.s.pile.pop()!
      this.s.deck = shuffled().filter((c) => this.s.pile.includes(c)); this.s.pile = [keep]
    }
    const c = this.s.deck.pop()
    if (c === undefined) return null
    this.s.hands[seat].push(c)
    return c
  }
  private advance(steps = 1) { this.s.turn = this.next(this.s.turn, steps); this.s.drew = false }

  protected act(seat: number, m: any): string | null {
    const s = this.s
    if (m?.pass) { if (!s.drew) return 'draw_first'; s.last = { seat, what: 'pass' }; this.advance(); return null }
    if (m?.draw) {
      if (s.drew) return 'already_drew'
      const c = this.drawOne(seat); s.drew = true; s.last = { seat, what: 'draw' }
      void c // a drawn card that cannot be played ends the turn when the player presses Pass (a bot passes by itself)
      return null
    }
    const card = Number(m?.card)
    if (!s.hands[seat].includes(card)) return 'not_in_hand'
    if (!this.canPlay(card)) return 'cannot_play'
    let suit = suitOf(card)
    if (rankOf(card) === EIGHT) { suit = Number(m?.suit); if (![0, 1, 2, 3].includes(suit)) return 'choose_suit' }
    s.hands[seat].splice(s.hands[seat].indexOf(card), 1); s.pile.push(card); s.suit = suit
    s.last = { seat, what: 'play', card }
    if (s.hands[seat].length === 0) { s.winner = seat; return null }
    let steps = 1
    if (this.config.action) {
      const r = rankOf(card)
      if (r === ACE) { if (this.n === 2) steps = 2; else s.dir = (s.dir === 1 ? -1 : 1) as 1 | -1 }
      else if (r === JACK) steps = 2
      else if (r === TWO) { const v = this.next(seat); this.drawOne(v); this.drawOne(v); steps = 2 }
    }
    this.advance(steps)
    return null
  }

  protected bot(seat: number): void {
    const s = this.s
    const ok = this.playable(seat)
    if (ok.length) {
      // keep the 8s for when they are needed, shed high cards first, prefer the suit we hold the most of
      const hand = s.hands[seat]
      const count = [0, 0, 0, 0]; for (const c of hand) count[suitOf(c)]++
      const plain = ok.filter((c) => rankOf(c) !== EIGHT)
      const pick = (plain.length ? plain : ok).sort((a, b) => worth(b) - worth(a) + (count[suitOf(b)] - count[suitOf(a)]) * 0.5)[0]
      const rest = hand.filter((c) => c !== pick)
      const best = [0, 1, 2, 3].sort((a, b) => rest.filter((c) => suitOf(c) === b).length - rest.filter((c) => suitOf(c) === a).length)[0]
      this.act(seat, { card: pick, suit: best })
      return
    }
    if (!s.drew) { this.act(seat, { draw: true }); if (this.playable(seat).length) return this.bot(seat) }
    this.act(seat, { pass: true })
  }

  protected gameView(seat: number) {
    const s = this.s
    const over = s.winner >= 0
    return {
      hand: seat >= 0 ? s.hands[seat] : [], hands: over ? s.hands : null, counts: s.hands.map((h) => h.length), top: this.top(), suit: s.suit, dir: s.dir, drawCount: s.deck.length,
      drew: s.drew && seat === s.turn, playable: seat >= 0 && seat === s.turn && this.status === 'playing' ? this.playable(seat) : [], last: s.last, winner: s.winner, action: !!this.config.action,
    }
  }
  protected outcome(): Outcome | null {
    const s = this.s
    if (s.winner < 0) return null
    const lost = s.hands.map((h, i) => (i === s.winner ? 0 : h.reduce((a, c) => a + worth(c), 0)))
    const points = lost.map((l, i) => (i === s.winner ? lost.reduce((a, b) => a + b, 0) : -l))
    return { points, winner: s.winner }
  }
  protected saveState() { return this.s }
  protected loadState(s: State) { this.s = s }
}
