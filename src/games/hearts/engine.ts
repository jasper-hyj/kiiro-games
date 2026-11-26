import { TurnGame, type GameMeta, type Outcome } from '../frame/base'
import { rankOf, shuffled, suitOf } from '../holdem/engine/cards'

/**
 * Hearts for four. Each heart you take costs a point, the Queen of Spades costs 13; fewest points wins. One deal per game: pass three cards
 * (left, right, across, then none), the 2 of clubs leads, you must follow suit, no points on the first trick, hearts cannot lead until broken.
 * Taking every point ("shooting the moon") gives everybody else 26.
 */
export const HEARTS_META: GameMeta = {
  kind: 'hearts',
  minPlayers: 4,
  maxPlayers: 4,
  variable: false,
  chipUnit: 40,
  fields: [],
  defaults: { ranked: false },
}
const SPADES = 0,
  HEARTS = 1,
  CLUBS = 3,
  QUEEN = 10
export const QS = SPADES * 13 + QUEEN,
  TWO_CLUBS = CLUBS * 13
const pts = (c: number) => (suitOf(c) === HEARTS ? 1 : c === QS ? 13 : 0)
const order = (a: number, b: number) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b)

interface State {
  hands: number[][]
  phase: 'pass' | 'play' | 'done'
  dir: number
  picked: (number[] | null)[]
  turn: number
  lead: number
  trick: { seat: number; card: number }[]
  taken: number[]
  broken: boolean
  tricks: number
  last: { seat: number; card: number }[] | null
  lastWinner: number
  scores: number[]
  moon: number
}

export class Hearts extends TurnGame {
  readonly meta = HEARTS_META
  private s: State = {
    hands: [],
    phase: 'pass',
    dir: 0,
    picked: [],
    turn: 0,
    lead: 0,
    trick: [],
    taken: [],
    broken: false,
    tricks: 0,
    last: null,
    lastWinner: -1,
    scores: [0, 0, 0, 0],
    moon: -1,
  }

  protected begin() {
    const d = shuffled()
    const hands = [0, 1, 2, 3].map((i) => d.slice(i * 13, i * 13 + 13).sort(order))
    const dir = (this.gameNo - 1) % 4 // 0 left, 1 right, 2 across, 3 keep
    this.s = {
      hands,
      phase: dir === 3 ? 'play' : 'pass',
      dir,
      picked: [null, null, null, null],
      turn: 0,
      lead: 0,
      trick: [],
      taken: [0, 0, 0, 0],
      broken: false,
      tricks: 0,
      last: null,
      lastWinner: -1,
      scores: [0, 0, 0, 0],
      moon: -1,
    }
    if (this.s.phase === 'play') return this.startPlay()
    // the computer's seats choose straight away; people choose in any order
    this.seats.forEach((seat, i) => {
      if (seat.bot) this.doPass(i, this.passChoice(i))
    })
  }
  private startPlay() {
    this.s.phase = 'play'
    const who = this.s.hands.findIndex((h) => h.includes(TWO_CLUBS))
    this.s.turn = who
    this.s.lead = who
  }
  turn() {
    return this.status === 'playing' && this.s.phase !== 'done' ? this.s.turn : -1
  }

  // ---- passing ----
  protected simultaneous() {
    return this.s.phase === 'pass'
  }
  protected mayAct(seat: number) {
    return this.s.phase === 'pass' && !this.s.picked[seat]
  }
  private doPass(seat: number, cards: number[]) {
    this.s.picked[seat] = cards
    const next = this.s.picked.findIndex((p) => !p)
    if (next >= 0) {
      this.s.turn = next
      return
    }
    const shift = this.s.dir === 0 ? 1 : this.s.dir === 1 ? 3 : 2
    const give = this.s.picked as number[][]
    for (let i = 0; i < 4; i++) this.s.hands[i] = this.s.hands[i].filter((c) => !give[i].includes(c))
    for (let i = 0; i < 4; i++) this.s.hands[(i + shift) % 4].push(...give[i])
    for (const h of this.s.hands) h.sort(order)
    this.startPlay()
  }
  // ---- play ----
  /** the cards `seat` may play right now */
  legal(seat: number): number[] {
    const hand = this.s.hands[seat]
    if (this.s.trick.length === 0) {
      if (this.s.tricks === 0) return hand.includes(TWO_CLUBS) ? [TWO_CLUBS] : hand
      if (this.s.broken) return hand
      const free = hand.filter((c) => suitOf(c) !== HEARTS)
      return free.length ? free : hand
    }
    const lead = suitOf(this.s.trick[0].card)
    const follow = hand.filter((c) => suitOf(c) === lead)
    if (follow.length) return follow
    if (this.s.tricks === 0) {
      const safe = hand.filter((c) => pts(c) === 0)
      if (safe.length) return safe
    }
    return hand
  }
  protected act(seat: number, m: any): string | null {
    if (this.s.phase === 'pass') {
      if (this.s.picked[seat]) return 'bad_move'
      const cards = Array.isArray(m?.pass) ? m.pass.map(Number) : []
      if (cards.length !== 3 || new Set(cards).size !== 3 || !cards.every((c: number) => this.s.hands[seat].includes(c))) return 'bad_move'
      this.doPass(seat, cards)
      return null
    }
    const c = Number(m?.card)
    if (!this.legal(seat).includes(c)) return 'bad_card'
    this.playCard(seat, c)
    return null
  }
  private playCard(seat: number, c: number) {
    const h = this.s.hands[seat]
    h.splice(h.indexOf(c), 1)
    this.s.trick.push({ seat, card: c })
    if (pts(c) > 0 && suitOf(c) === HEARTS) this.s.broken = true
    if (c === QS) this.s.broken = this.s.broken || false
    if (this.s.trick.length < 4) {
      this.s.turn = (seat + 1) % 4
      return
    }
    // the trick is complete: the highest card of the suit led takes it
    const lead = suitOf(this.s.trick[0].card)
    const win = this.s.trick.reduce((a, b) => (suitOf(b.card) === lead && (suitOf(a.card) !== lead || rankOf(b.card) > rankOf(a.card)) ? b : a))
    this.s.taken[win.seat] += this.s.trick.reduce((a, t) => a + pts(t.card), 0)
    this.s.last = this.s.trick
    this.s.lastWinner = win.seat
    this.s.trick = []
    this.s.tricks++
    if (this.s.tricks === 13) {
      this.settle()
      return
    }
    this.s.turn = win.seat
    this.s.lead = win.seat
  }
  private settle() {
    this.s.phase = 'done'
    const t = this.s.taken
    const moon = t.findIndex((x) => x === 26)
    this.s.moon = moon
    this.s.scores = moon >= 0 ? t.map((_, i) => (i === moon ? 0 : 26)) : t.slice()
  }

  /** which three cards the computer gives away: the ones most likely to cost it points */
  private passChoice(seat: number): number[] {
    const hand = this.s.hands[seat]
    const spadesLow = hand.filter((c) => suitOf(c) === SPADES && rankOf(c) < QUEEN).length
    const risk = (c: number) => {
      const r = rankOf(c),
        su = suitOf(c)
      if (c === QS) return spadesLow < 3 ? 100 : 5
      if (su === SPADES && r > QUEEN) return spadesLow < 3 ? 60 + r : 0
      if (su === HEARTS) return 20 + r * 2
      return r + (hand.filter((x) => suitOf(x) === su).length <= 3 ? 10 : 0)
    }
    return [...hand].sort((a, b) => risk(b) - risk(a) + (Math.random() - 0.5)).slice(0, 3)
  }

  // ---- the bot ----
  protected bot(seat: number) {
    const hand = this.s.hands[seat]
    if (this.s.phase === 'pass') return this.doPass(seat, this.passChoice(seat))
    const ok = this.legal(seat)
    this.playCard(seat, this.choose(seat, ok))
  }
  private choose(seat: number, ok: number[]): number {
    if (ok.length === 1) return ok[0]
    const trick = this.s.trick
    const lowest = (a: number[]) => a.reduce((x, y) => (rankOf(y) < rankOf(x) ? y : x))
    const highest = (a: number[]) => a.reduce((x, y) => (rankOf(y) > rankOf(x) ? y : x))
    if (trick.length === 0) {
      // leading
      const safe = ok.filter((c) => suitOf(c) !== HEARTS && c !== QS && !(suitOf(c) === SPADES && rankOf(c) >= QUEEN))
      const pool = safe.length ? safe : ok
      // lead low in the suit where I hold the fewest cards, to get rid of dangerous suits
      const count = (su: number) => pool.filter((c) => suitOf(c) === su).length
      const suits = [0, 1, 2, 3].filter((su) => count(su) > 0).sort((a, b) => count(a) - count(b))
      return lowest(pool.filter((c) => suitOf(c) === suits[0]))
    }
    const lead = suitOf(trick[0].card)
    const inSuit = ok.filter((c) => suitOf(c) === lead)
    const winning = trick.filter((t) => suitOf(t.card) === lead).reduce((a, b) => (rankOf(b.card) > rankOf(a.card) ? b : a)).card
    const trickPts = trick.reduce((a, t) => a + pts(t.card), 0)
    if (inSuit.length) {
      const under = inSuit.filter((c) => rankOf(c) < rankOf(winning))
      if (under.length) return highest(under) // duck as high as possible
      if (trick.length === 3 && trickPts === 0) return inSuit.includes(QS) && inSuit.length > 1 ? highest(inSuit.filter((c) => c !== QS)) : highest(inSuit) // last in, safe: win it with the highest
      return lowest(inSuit)
    }
    // void: get rid of the worst cards
    if (ok.includes(QS)) return QS
    const hearts = ok.filter((c) => suitOf(c) === HEARTS)
    if (hearts.length) return highest(hearts)
    const spadeHigh = ok.filter((c) => suitOf(c) === SPADES && rankOf(c) > QUEEN)
    if (spadeHigh.length) return highest(spadeHigh)
    return highest(ok)
  }

  protected controller(turn: number) {
    return turn
  }
  protected gameView(seat: number) {
    const s = this.s
    return {
      phase: s.phase,
      dir: s.dir,
      hand: seat >= 0 ? s.hands[seat] : [],
      counts: s.hands.map((h) => h.length),
      picked: s.picked.map((p) => !!p),
      trick: s.trick,
      lead: s.lead,
      last: s.last,
      lastWinner: s.lastWinner,
      broken: s.broken,
      taken: s.taken,
      scores: s.scores,
      moon: s.moon,
      legal: seat >= 0 && s.phase !== 'done' && s.turn === seat && s.phase === 'play' ? this.legal(seat) : [],
      tricks: s.tricks,
    }
  }
  protected outcome(): Outcome | null {
    if (this.s.phase !== 'done') return null
    const sc = this.s.scores,
      best = Math.min(...sc)
    const winners = sc.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0)
    const avg = sc.reduce((a, b) => a + b, 0) / 4
    return { points: sc.map((v) => avg - v), scores: sc, winner: winners.length === 1 ? winners[0] : -1, winners, summary: { scores: sc, moon: this.s.moon } }
  }
  protected saveState() {
    return this.s
  }
  protected loadState(s: State) {
    this.s = s
  }
}
