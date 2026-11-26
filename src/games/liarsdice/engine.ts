import { TurnGame, type GameMeta, type Outcome } from '../frame/base'

/**
 * Liar's Dice, 2 to 6 players. Everyone has five dice under a cup that only they can see. In turn, bid how many dice of one face there are
 * among ALL the dice on the table ("four threes"); each bid must be higher than the last: more dice, or the same number of a higher face.
 * Instead of bidding you may call "Liar!": all cups are lifted. If the bid is true the caller loses a die, otherwise the bidder does.
 * With "ones are wild" on, every 1 counts as any face (except when the bid is on ones themselves). The last player with dice wins.
 */
export const LIARS_META: GameMeta = {
  kind: 'liarsdice',
  minPlayers: 2,
  maxPlayers: 6,
  variable: true,
  chipUnit: 40,
  fields: [
    {
      key: 'players',
      label: 'ldPlayers',
      options: [
        [2, '2'],
        [3, '3'],
        [4, '4'],
        [5, '5'],
        [6, '6'],
      ],
    },
    {
      key: 'wild',
      label: 'ldWild',
      options: [
        [true, 'ldWildOn'],
        [false, 'ldWildOff'],
      ],
    },
  ],
  defaults: { players: 4, wild: true, ranked: false },
}

interface Bid {
  seat: number
  qty: number
  face: number
}
interface Round {
  bid: Bid
  caller: number
  dice: number[][]
  total: number
  liar: boolean
  loser: number
}
interface State {
  dice: number[][]
  left: number[]
  turn: number
  bid: Bid | null
  round: number
  reveal: Round | null
  out: number[]
  startedBy: number
}

export class LiarsDice extends TurnGame {
  readonly meta = LIARS_META
  private s: State = { dice: [], left: [], turn: 0, bid: null, round: 1, reveal: null, out: [], startedBy: 0 }
  private get n() {
    return this.seats.length
  }

  protected begin() {
    this.s = { dice: [], left: Array(this.n).fill(5), turn: (this.gameNo - 1) % this.n, bid: null, round: 1, reveal: null, out: [], startedBy: 0 }
    this.rollAll()
  }
  private rollAll() {
    this.s.dice = this.s.left.map((k) => Array.from({ length: k }, () => 1 + Math.floor(Math.random() * 6)))
  }
  turn() {
    return this.status === 'playing' && this.alive().length > 1 ? this.s.turn : -1
  }
  private alive() {
    return this.s.left.map((k, i) => (k > 0 ? i : -1)).filter((i) => i >= 0)
  }
  private nextAlive(from: number) {
    for (let k = 1; k <= this.n; k++) {
      const i = (from + k) % this.n
      if (this.s.left[i] > 0) return i
    }
    return from
  }
  private totalDice() {
    return this.s.left.reduce((a, b) => a + b, 0)
  }
  /** how many dice show this face on the table (ones are wild unless the bid is on ones) */
  private count(face: number) {
    let c = 0
    for (const d of this.s.dice) for (const x of d) if (x === face || (this.config.wild && face !== 1 && x === 1)) c++
    return c
  }
  private higher(q: number, f: number) {
    const b = this.s.bid
    return !b || q > b.qty || (q === b.qty && f > b.face)
  }

  protected act(seat: number, m: any): string | null {
    const s = this.s
    if (m?.liar) {
      if (!s.bid) return 'no_bid_yet'
      const total = this.count(s.bid.face)
      const liar = total < s.bid.qty
      const loser = liar ? s.bid.seat : seat
      s.reveal = { bid: s.bid, caller: seat, dice: s.dice.map((d) => [...d]), total, liar, loser }
      s.left[loser]--
      if (s.left[loser] === 0) s.out.push(loser)
      s.round++
      s.bid = null
      s.turn = s.left[loser] > 0 ? loser : this.nextAlive(loser)
      this.rollAll()
      return null
    }
    const qty = Number(m?.qty),
      face = Number(m?.face)
    if (!Number.isInteger(qty) || !Number.isInteger(face) || face < 1 || face > 6 || qty < 1 || qty > this.totalDice()) return 'bad_bid'
    if (!this.higher(qty, face)) return 'bid_higher'
    s.bid = { seat, qty, face }
    s.turn = this.nextAlive(seat)
    return null
  }

  protected bot(seat: number) {
    const s = this.s
    const mine = s.dice[seat]
    const others = this.totalDice() - mine.length
    const face = (f: number) => mine.filter((x) => x === f || (this.config.wild && f !== 1 && x === 1)).length
    // what we expect on the table: our own matching dice plus a third (a sixth for ones) of everybody else's
    const expect = (f: number) => face(f) + others * (this.config.wild && f !== 1 ? 1 / 3 : 1 / 6)
    if (s.bid) {
      const e = expect(s.bid.face)
      const slack = 0.9 + Math.random() * 0.9
      if (s.bid.qty > e + slack && Math.random() < 0.9) return void this.act(seat, { liar: true })
      if (s.bid.qty > e + 2.2) return void this.act(seat, { liar: true })
    }
    // the next bid: our best face at the smallest raise, with a bluff now and then
    const faces = [1, 2, 3, 4, 5, 6]
    const options: Bid[] = []
    const t = this.totalDice()
    for (const f of faces)
      for (let q = 1; q <= t; q++)
        if (this.higher(q, f)) {
          options.push({ seat, qty: q, face: f })
          if (q >= Math.max(s.bid?.qty ?? 0, Math.round(expect(f))) + 1) break
        }
    if (options.length === 0) return void this.act(seat, { liar: true })
    const scored = options.map((o) => ({
      o,
      v: -Math.abs(o.qty - expect(o.face) - (Math.random() < 0.15 ? 0.8 : 0)) + (face(o.face) > 0 ? 0.4 : 0) - (o.qty - (s.bid?.qty ?? 0)) * 0.15,
    }))
    scored.sort((a, b) => b.v - a.v)
    const pick = scored[Math.floor(Math.random() * Math.min(2, scored.length))].o
    this.act(seat, { qty: pick.qty, face: pick.face })
  }

  protected gameView(seat: number) {
    const s = this.s
    return {
      left: s.left,
      mine: seat >= 0 ? (s.dice[seat] ?? []) : [],
      bid: s.bid,
      round: s.round,
      reveal: s.reveal,
      out: s.out,
      wild: !!this.config.wild,
      total: this.totalDice(),
      dice: this.status === 'over' ? s.dice : null,
    }
  }
  protected outcome(): Outcome | null {
    if (this.alive().length > 1) return null
    const winner = this.alive()[0]
    // placing: the winner first, then the others in the reverse order they were knocked out
    const order = [winner, ...[...this.s.out].reverse()]
    const n = this.n
    const points = Array(n).fill(0)
    order.forEach((seat, place) => {
      points[seat] = (n - 1) / 2 - place
    })
    return { points, winner }
  }
  protected saveState() {
    return this.s
  }
  protected loadState(s: State) {
    this.s = s
  }
}
