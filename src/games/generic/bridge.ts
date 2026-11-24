import { TurnGame, type GameMeta, type Outcome } from './base'
import { rankOf as hRank, suitOf as hSuit } from '../holdem/engine/cards'

/**
 * Contract Bridge, four players in two partnerships (South and North against West and East). One deal per game: an auction (bids from 1 club up to 7 no-trump, pass,
 * double, redouble), then thirteen tricks. The declarer plays both their own hand and the dummy's. Scored like duplicate bridge with nobody vulnerable.
 * Cards are the same ids as Hold'em (0..51; the suit is 0 spades, 1 hearts, 2 diamonds, 3 clubs; the rank 0 is a deuce, 12 an ace).
 */
export const BRIDGE_META: GameMeta = {
  kind: 'bridge', minPlayers: 4, maxPlayers: 4, variable: false, chipUnit: 0.4,
  fields: [], defaults: { ranked: false },
}
export const SEATS = ['S', 'W', 'N', 'E'] // seat 0 is South; the order is clockwise, partners sit opposite
/** bid strains from low to high: clubs, diamonds, hearts, spades, no-trump (4) */
const STRAIN_OF_SUIT = [3, 2, 1, 0] // Hold'em suit index -> strain
const SUIT_OF_STRAIN = [3, 2, 1, 0]
export const strainOf = (c: number) => STRAIN_OF_SUIT[hSuit(c)]
const hcp = (h: number[]) => h.reduce((a, c) => a + Math.max(0, hRank(c) - 8), 0) // J=1 Q=2 K=3 A=4
const side = (seat: number) => seat % 2 // 0: South and North, 1: West and East

export type Call = { t: 'pass' } | { t: 'x' } | { t: 'xx' } | { t: 'bid'; level: number; strain: number }
interface Contract { level: number; strain: number; declarer: number; doubled: 0 | 1 | 2 }
interface State {
  dealer: number; hands: number[][]; calls: { seat: number; call: Call }[]; turn: number
  contract: Contract | null; phase: 'bid' | 'play' | 'done'; leader: number
  trick: { seat: number; card: number }[]; last: { seat: number; card: number }[]; tricks: number[]; dummyOpen: boolean; score: number
}
const level5 = (b: { level: number; strain: number }) => b.level * 5 + b.strain

/** the duplicate-bridge score for the declaring side (negative when the contract fails), nobody vulnerable */
export function scoreContract(level: number, strain: number, doubled: 0 | 1 | 2, tricksTaken: number): number {
  const need = 6 + level
  const mult = doubled === 2 ? 4 : doubled === 1 ? 2 : 1
  if (tricksTaken < need) {
    const down = need - tricksTaken
    if (doubled === 0) return -50 * down
    let pen = 0
    for (let i = 1; i <= down; i++) pen += i === 1 ? 100 : i <= 3 ? 200 : 300
    return -pen * (doubled === 2 ? 2 : 1)
  }
  const per = strain >= 2 && strain <= 3 ? 30 : 20
  const base = strain === 4 ? 40 + 30 * (level - 1) : per * level
  const trick = base * mult
  const over = tricksTaken - need
  const overPts = doubled === 0 ? over * (strain === 4 ? 30 : per) : over * 100 * (doubled === 2 ? 2 : 1)
  const bonus = trick >= 100 ? 300 : 50
  const slam = level === 7 ? 1000 : level === 6 ? 500 : 0
  const insult = doubled === 1 ? 50 : doubled === 2 ? 100 : 0
  return trick + overPts + bonus + slam + insult
}

export class Bridge extends TurnGame {
  readonly meta = BRIDGE_META
  constructor() { super(); this.botDelayMs = 550 } // fifty-two cards are played in a deal: keep the computer's pace brisk
  private s: State = { dealer: 0, hands: [], calls: [], turn: 0, contract: null, phase: 'bid', leader: 0, trick: [], last: [], tricks: [0, 0], dummyOpen: false, score: 0 }

  protected begin() {
    const deck = Array.from({ length: 52 }, (_, i) => i)
    for (let i = 51; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] }
    const hands = [0, 1, 2, 3].map((k) => deck.slice(k * 13, k * 13 + 13).sort((a, b) => strainOf(b) - strainOf(a) || hRank(b) - hRank(a)))
    const dealer = (this.gameNo - 1) % 4
    this.s = { dealer, hands, calls: [], turn: dealer, contract: null, phase: 'bid', leader: 0, trick: [], last: [], tricks: [0, 0], dummyOpen: false, score: 0 }
  }
  turn() { return this.status === 'playing' && this.s.phase !== 'done' ? this.s.turn : -1 }
  /** the declarer plays the dummy's cards */
  protected controller(turnSeat: number): number {
    const c = this.s.contract
    return this.s.phase === 'play' && c && turnSeat === (c.declarer + 2) % 4 ? c.declarer : turnSeat
  }

  // ---------------------------------------------------------------- the auction
  private lastBid() { for (let i = this.s.calls.length - 1; i >= 0; i--) { const c = this.s.calls[i].call; if (c.t === 'bid') return { ...c, seat: this.s.calls[i].seat, index: i } } return null }
  private canX(seat: number) { const lb = this.lastBid(); if (!lb || side(lb.seat) === side(seat)) return false; return !this.s.calls.slice(lb.index + 1).some((x) => x.call.t === 'x' || x.call.t === 'xx') }
  private canXX(seat: number) { const lb = this.lastBid(); if (!lb || side(lb.seat) !== side(seat)) return false; const after = this.s.calls.slice(lb.index + 1); return after.some((x) => x.call.t === 'x') && !after.some((x) => x.call.t === 'xx') }
  private legalBid(level: number, strain: number) { const lb = this.lastBid(); return level >= 1 && level <= 7 && strain >= 0 && strain <= 4 && (!lb || level5({ level, strain }) > level5(lb)) }
  private finishAuction() {
    const s = this.s
    const lb = this.lastBid()
    if (!lb) { s.phase = 'done'; s.score = 0; return }
    const first = s.calls.find((x) => x.call.t === 'bid' && x.call.strain === lb.strain && side(x.seat) === side(lb.seat))!
    const after = s.calls.slice(lb.index + 1)
    s.contract = { level: lb.level, strain: lb.strain, declarer: first.seat, doubled: after.some((x) => x.call.t === 'xx') ? 2 : after.some((x) => x.call.t === 'x') ? 1 : 0 }
    s.phase = 'play'; s.leader = (first.seat + 1) % 4; s.turn = s.leader
  }

  protected act(seat: number, m: any): string | null {
    const s = this.s
    if (s.phase === 'bid') {
      const who = s.turn
      const c = m?.call
      if (!c) return 'bad_call'
      let call: Call
      if (c === 'pass') call = { t: 'pass' }
      else if (c === 'x') { if (!this.canX(who)) return 'cannot_double'; call = { t: 'x' } }
      else if (c === 'xx') { if (!this.canXX(who)) return 'cannot_redouble'; call = { t: 'xx' } }
      else if (typeof c === 'object' && c !== null) { const level = Number(c.level), strain = Number(c.strain); if (!Number.isInteger(level) || !Number.isInteger(strain) || !this.legalBid(level, strain)) return 'bid_higher'; call = { t: 'bid', level, strain } }
      else return 'bad_call'
      s.calls.push({ seat: who, call })
      const n = s.calls.length
      const passesEnd = (() => { let k = 0; for (let i = n - 1; i >= 0 && s.calls[i].call.t === 'pass'; i--) k++; return k })()
      const anyBid = s.calls.some((x) => x.call.t === 'bid')
      if (!anyBid && passesEnd >= 4) { this.finishAuction(); return null }
      if (anyBid && passesEnd >= 3) { this.finishAuction(); return null }
      s.turn = (who + 1) % 4
      return null
    }
    // play: `seat` is whoever is moving; the card belongs to the hand whose turn it is
    const who = s.turn
    const card = Number(m?.card)
    if (!s.hands[who].includes(card)) return 'not_in_hand'
    const led = s.trick.length ? hSuit(s.trick[0].card) : -1
    if (led >= 0 && hSuit(card) !== led && s.hands[who].some((x) => hSuit(x) === led)) return 'follow_suit'
    s.hands[who] = s.hands[who].filter((x) => x !== card)
    s.trick.push({ seat: who, card })
    if (s.trick.length === 1 && s.last.length === 0 && s.tricks[0] + s.tricks[1] === 0) s.dummyOpen = true // the dummy goes down after the opening lead
    if (s.trick.length < 4) { s.turn = (who + 1) % 4; return null }
    // the trick is complete
    const trump = s.contract!.strain === 4 ? -1 : SUIT_OF_STRAIN[s.contract!.strain]
    const ledSuit = hSuit(s.trick[0].card)
    let best = s.trick[0]
    for (const t of s.trick.slice(1)) {
      const bs = hSuit(best.card), ts = hSuit(t.card)
      if (ts === bs ? hRank(t.card) > hRank(best.card) : ts === trump) best = t
    }
    void ledSuit
    s.tricks[side(best.seat)]++
    s.last = s.trick; s.trick = []
    s.leader = best.seat; s.turn = best.seat
    if (s.hands.every((h) => h.length === 0)) {
      const c = s.contract!
      const taken = s.tricks[side(c.declarer)]
      const sc = scoreContract(c.level, c.strain, c.doubled, taken)
      s.score = side(c.declarer) === 0 ? sc : -sc // positive: South-North
      s.phase = 'done'
    }
    return null
  }

  // ---------------------------------------------------------------- the computer
  private points(h: number[]) {
    const len = [0, 0, 0, 0]; for (const c of h) len[strainOf(c)]++
    const dist = len.reduce((a, n) => a + (n === 0 ? 3 : n === 1 ? 2 : n === 2 ? 1 : 0), 0)
    return { hcp: hcp(h), total: hcp(h) + dist, len, balanced: len.every((n) => n >= 2) && len.filter((n) => n === 2).length <= 1 }
  }
  private callBot(seat: number): Call {
    const s = this.s
    const h = s.hands[seat]; const p = this.points(h)
    const lb = this.lastBid()
    const bid = (level: number, strain: number): Call | null => (this.legalBid(level, strain) ? { t: 'bid', level, strain } : null)
    const cheapest = (strain: number): Call | null => { for (let l = 1; l <= 7; l++) if (this.legalBid(l, strain)) return { t: 'bid', level: l, strain }; return null }
    const longest = [3, 2, 1, 0].sort((a, b) => p.len[b] - p.len[a] || b - a)[0]
    const bestMajor = p.len[3] >= p.len[2] ? 3 : 2
    if (!lb) { // opening
      if (p.balanced && p.hcp >= 15 && p.hcp <= 17) return bid(1, 4) ?? { t: 'pass' }
      if (p.total >= 13) { const suit = p.len[bestMajor] >= 5 ? bestMajor : p.len[1] >= p.len[0] && p.len[1] >= 4 ? 1 : p.len[0] >= 3 ? 0 : longest; return bid(1, suit) ?? { t: 'pass' } }
      return { t: 'pass' }
    }
    const mine = side(lb.seat) === side(seat)
    const partnerBid = [...s.calls].reverse().find((x) => x.seat === (seat + 2) % 4 && x.call.t === 'bid')
    if (mine) { // our side holds the last bid
      const lvl = lb.level
      const total = p.total + (partnerBid && lb.seat !== seat ? 0 : 0)
      // game bidding: with enough combined strength raise to game
      if (lb.seat !== seat && partnerBid && partnerBid.call.t === 'bid') {
        const ps = partnerBid.call.strain
        const supportP = ps < 4 ? p.len[ps] >= 3 : false
        const want = total >= 13 ? 'game' : total >= 10 ? 'invite' : total >= 6 ? 'raise' : 'none'
        const gameLevel = ps >= 2 && ps <= 3 ? 4 : ps === 4 ? 3 : 5
        if (lvl >= gameLevel) return { t: 'pass' }
        if (want === 'game' && supportP) return bid(gameLevel, ps) ?? { t: 'pass' }
        if (want === 'game' && !supportP) return bid(3, 4) ?? bid(Math.max(lvl, 1) + 1, 4) ?? { t: 'pass' }
        if (want === 'invite' && supportP) return bid(Math.min(3, lvl + 2), ps) ?? { t: 'pass' }
        if (want === 'raise' && supportP) return bid(lvl + 1, ps) ?? { t: 'pass' }
        if (want !== 'none' && !supportP && lvl === 1) { const nt = bid(want === 'invite' ? 2 : 1, 4); return nt ?? { t: 'pass' } }
      }
      return { t: 'pass' }
    }
    // the opponents hold the last bid
    if (lb.level >= 5 && p.hcp >= 10 && this.canX(seat)) return { t: 'x' }
    if (p.total >= 12 && lb.level <= 2) {
      const suit = [3, 2, 1, 0].filter((x) => p.len[x] >= 5).sort((a, b) => p.len[b] - p.len[a] || b - a)[0]
      if (suit !== undefined) return cheapest(suit) ?? { t: 'pass' }
      if (p.balanced && p.hcp >= 15 && lb.level === 1 && lb.strain < 4) return cheapest(4) ?? { t: 'pass' }
    }
    return { t: 'pass' }
  }
  private cardBot(seat: number): number {
    const s = this.s
    const hand = s.hands[seat]
    const c = s.contract!
    const trump = c.strain === 4 ? -1 : SUIT_OF_STRAIN[c.strain]
    const bySuit = (su: number) => hand.filter((x) => hSuit(x) === su).sort((a, b) => hRank(b) - hRank(a))
    if (s.trick.length === 0) { // leading
      const suits = [0, 1, 2, 3].filter((su) => bySuit(su).length > 0)
      const pool = suits.filter((su) => su !== trump).length ? suits.filter((su) => su !== trump) : suits
      // an ace or a top of a sequence first, otherwise the fourth best of the longest suit
      for (const su of pool) { const cs = bySuit(su); if (hRank(cs[0]) === 12 && (cs.length < 2 || hRank(cs[1]) < 11)) return cs[0] }
      for (const su of pool) { const cs = bySuit(su); if (cs.length >= 3 && hRank(cs[0]) >= 11 && hRank(cs[1]) === hRank(cs[0]) - 1) return cs[0] }
      const long = pool.sort((a, b) => bySuit(b).length - bySuit(a).length)[0]
      const cs = bySuit(long)
      return cs[Math.min(3, cs.length - 1)] ?? cs[cs.length - 1]
    }
    const led = hSuit(s.trick[0].card)
    const following = bySuit(led)
    const win = (t: { seat: number; card: number }[]) => { let best = t[0]; for (const x of t.slice(1)) { const bs = hSuit(best.card), ts = hSuit(x.card); if (ts === bs ? hRank(x.card) > hRank(best.card) : ts === trump) best = x } return best }
    const cur = win(s.trick)
    const partnerWinning = side(cur.seat) === side(seat)
    const last = s.trick.length === 3
    if (following.length) {
      if (partnerWinning && (last || hRank(cur.card) >= 11)) return following[following.length - 1]
      const beaters = following.filter((x) => hSuit(cur.card) === led && hRank(x) > hRank(cur.card))
      if (beaters.length && !(partnerWinning)) { return last || hRank(cur.card) >= 10 || s.trick.length === 2 ? beaters[beaters.length - 1] : beaters[beaters.length - 1] }
      return following[following.length - 1]
    }
    // void: ruff when the opponents are winning, otherwise throw the lowest card of the weakest side suit
    const trumps = trump >= 0 ? bySuit(trump) : []
    if (trumps.length && !partnerWinning) { const over = trumps.filter((x) => hSuit(cur.card) !== trump || hRank(x) > hRank(cur.card)); if (over.length) return over[over.length - 1] }
    const others = hand.filter((x) => hSuit(x) !== trump || trump < 0)
    const pool = others.length ? others : hand
    return pool.sort((a, b) => hRank(a) - hRank(b))[0]
  }
  protected bot(seat: number) {
    const s = this.s
    if (s.phase === 'bid') { const c = this.callBot(seat); this.act(this.controller(seat), { call: c.t === 'bid' ? { level: c.level, strain: c.strain } : c.t }); return }
    const card = this.cardBot(seat)
    this.act(this.controller(seat), { card })
  }

  // ---------------------------------------------------------------- views and results
  protected gameView(seat: number) {
    const s = this.s
    const c = s.contract
    const dummy = c ? (c.declarer + 2) % 4 : -1
    const showDummy = s.phase !== 'bid' && s.dummyOpen && dummy >= 0
    const mover = s.turn
    const canMove = seat >= 0 && this.status === 'playing' && this.controller(mover) === seat
    const led = s.trick.length ? hSuit(s.trick[0].card) : -1
    const hand = s.hands[mover] ?? []
    const legalCards = s.phase === 'play' && canMove ? (led >= 0 && hand.some((x) => hSuit(x) === led) ? hand.filter((x) => hSuit(x) === led) : hand) : []
    const lb = this.lastBid()
    return {
      phase: s.phase, dealer: s.dealer, calls: s.calls, contract: c, mine: seat >= 0 ? s.hands[seat] : [], dummy: showDummy ? { seat: dummy, cards: s.hands[dummy] } : null,
      trick: s.trick, last: s.last, tricks: s.tricks, controls: seat >= 0 ? [seat, ...(c && seat === c.declarer && s.phase === 'play' ? [dummy] : [])] : [],
      mover, canMove, legal: legalCards, minBid: lb ? level5(lb) + 1 : 1, canX: seat >= 0 && s.phase === 'bid' && this.canX(s.turn), canXX: seat >= 0 && s.phase === 'bid' && this.canXX(s.turn),
      counts: s.hands.map((h) => h.length), hands: s.phase === 'done' ? s.hands : null, score: s.phase === 'done' ? s.score : null,
    }
  }
  protected outcome(): Outcome | null {
    if (this.s.phase !== 'done') return null
    const ns = this.s.score
    return { points: [ns, -ns, ns, -ns], winner: ns === 0 ? -1 : ns > 0 ? 0 : 1, summary: { contract: this.s.contract, tricks: this.s.tricks, score: ns } }
  }
  protected saveState() { return this.s }
  protected loadState(s: State) { this.s = s }
}
