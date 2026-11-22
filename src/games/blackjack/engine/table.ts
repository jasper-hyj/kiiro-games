import { rankOf, shuffled } from '../../holdem/engine/cards'
import type { CashGame, HandRecord } from '../../shared/cash'

export const MIN_BETS = [10, 20, 50, 100, 200]
export interface BjConfig { bet: number; casual: boolean; maxSeats: number }
export const DEFAULT_BJ: BjConfig = { bet: 10, casual: true, maxSeats: 6 }
const DECKS = 6

/** Card value with aces high: 2-10 face value, J Q K = 10, A = 11. */
export const cardValue = (c: number) => { const r = rankOf(c); return r === 12 ? 11 : r >= 8 ? 10 : r + 2 }
/** Best total of a hand and whether it is soft (an ace still counts as 11). */
export function total(cards: number[]): { sum: number; soft: boolean } {
  let sum = 0, aces = 0
  for (const c of cards) { sum += cardValue(c); if (rankOf(c) === 12) aces++ }
  while (sum > 21 && aces > 0) { sum -= 10; aces-- }
  return { sum, soft: aces > 0 }
}
export const isNatural = (cards: number[]) => cards.length === 2 && total(cards).sum === 21

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust'
export interface Hand { cards: number[]; bet: number; doubled: boolean; done: boolean; fromSplit: boolean; outcome?: Outcome; net: number }
export interface BSeat {
  id: string | null; name: string; stack: number; buyin: number
  /** chips wagered for the coming round, taken off the stack when placed */
  pending: number
  hands: Hand[]; inRound: boolean
  out: boolean; connected: boolean; missed: number; dcAt: number
  /** left while a round was running: the seat closes when it ends */
  leaveAfter: boolean
}
export type Phase = 'wait' | 'bet' | 'play' | 'dealer' | 'result'
export type BjAct = { a: 'bet'; amount: number } | { a: 'hit' } | { a: 'stand' } | { a: 'double' } | { a: 'split' }
export interface BjView {
  config: BjConfig; you: number; host: boolean; phase: Phase; round: number
  dealer: { cards: (number | null)[]; value: number | null }
  seats: { seat: number; name: string; stack: number; pending: number; hands: (Hand & { value: number; soft: boolean })[]; inRound: boolean; empty: boolean; me: boolean; out: boolean; connected: boolean }[]
  toAct: { seat: number; hand: number } | null
  options: null | { hit: boolean; stand: boolean; double: boolean; split: boolean }
  betLimits: { min: number; max: number }
  canBet: boolean
  timeLeft: number | null
  nextIn: number | null
  buyin: { min: number; max: number }
  yourBuyin: number
  spectators: number
}

const clean = (s: unknown, n = 16) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n)

export class BlackjackTable implements CashGame {
  config: BjConfig
  seats: BSeat[]
  members = new Set<string>()
  hostId: string | null = null
  phase: Phase = 'wait'
  round = 0
  shoe: number[] = []
  dealer: number[] = []
  toAct: { seat: number; hand: number } | null = null
  listeners = new Set<() => void>()
  onCashout: ((id: string, stack: number, buyin: number) => void) | null = null
  onHand: ((rec: HandRecord) => void) | null = null
  /** per-decision limit in ms (0 = off) and the betting window */
  turnTimerMs = 20000
  betMs = 20000
  resultMs = 5000
  graceMs = 60000
  autostart = true
  riggedShoe: number[] | null = null
  private deadline: number | null = null
  private nextAt: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private nextTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: BjConfig = DEFAULT_BJ) {
    this.config = { ...config }
    this.seats = Array.from({ length: config.maxSeats }, () => this.empty())
  }
  private empty(): BSeat { return { id: null, name: '', stack: 0, buyin: 0, pending: 0, hands: [], inRound: false, out: false, connected: false, missed: 0, dcAt: 0, leaveAfter: false } }
  get minBet() { return this.config.bet }
  get maxBet() { return this.config.bet * 50 }
  get minBuyin() { return this.config.bet * 20 }
  get maxBuyin() { return this.config.bet * 200 }
  get casualStack() { return this.config.bet * 100 }
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit() { this.listeners.forEach((f) => f()) }
  seatOf(id: string) { return this.seats.findIndex((s) => s.id === id) }
  hasPlayers() { return this.members.size > 0 || this.seats.some((s) => s.id) }

  // ---- membership (same contract as the other chip tables) ----
  admit(id: string, create: boolean): 'ok' | 'code_taken' | 'room_not_found' {
    if (this.seatOf(id) >= 0 || this.members.has(id)) return 'ok'
    if (create) return this.hasPlayers() ? 'code_taken' : 'ok'
    return this.hasPlayers() ? 'ok' : 'room_not_found'
  }
  join(id: string) {
    this.members.add(id)
    if (!this.hostId) this.hostId = id
    const s = this.seats[this.seatOf(id)]
    if (s) { s.connected = true; s.dcAt = 0 }
    this.emit(); this.drive()
  }
  disconnect(id: string) {
    this.members.delete(id)
    const i = this.seatOf(id)
    if (i >= 0) { this.seats[i].connected = false; this.seats[i].dcAt = Date.now(); setTimeout(() => { const s = this.seats[i]; if (s.id === id && !s.connected) this.standUp(id) }, this.graceMs + 50) }
    this.reassignHost(); this.emit(); this.drive()
  }
  private reassignHost() {
    if (this.hostId && (this.members.has(this.hostId) || this.seatOf(this.hostId) >= 0)) return
    this.hostId = [...this.members][0] ?? this.seats.find((s) => s.id)?.id ?? null
  }
  canSit(id: string, amount: number): string | null {
    if (this.seatOf(id) >= 0) return 'already_seated'
    if (!Number.isInteger(amount) || amount < this.minBuyin || amount > this.maxBuyin) return 'bad_buyin'
    if (!this.seats.some((s) => !s.id)) return 'table_full'
    return null
  }
  sit(id: string, name: string, amount: number): { ok: true; seat: number } | { ok: false; error: string } {
    const bad = this.canSit(id, amount)
    if (bad) return { ok: false, error: bad }
    const i = this.seats.findIndex((s) => !s.id)
    Object.assign(this.seats[i], this.empty(), { id, name: clean(name) || 'Player', stack: amount, buyin: amount, connected: true })
    this.members.add(id)
    if (!this.hostId) this.hostId = id
    this.emit(); this.drive()
    return { ok: true, seat: i }
  }
  private busy(s: BSeat) { return s.inRound && (this.phase === 'play' || this.phase === 'dealer') }
  rebuyRoom(id: string) { const s = this.seats[this.seatOf(id)]; return !s || this.busy(s) ? 0 : Math.max(0, this.maxBuyin - s.stack - s.pending) }
  rebuy(id: string, amount: number): boolean {
    const s = this.seats[this.seatOf(id)]
    if (!s || !Number.isInteger(amount) || amount <= 0 || amount > this.rebuyRoom(id)) return false
    s.stack += amount; s.buyin += amount; s.out = false; s.missed = 0
    this.emit(); this.drive(); return true
  }
  standUp(id: string) {
    const i = this.seatOf(id)
    if (i < 0) return
    const s = this.seats[i]
    if (this.busy(s)) { s.leaveAfter = true; s.out = true; this.afterTurnChange(); return } // the round plays on; the seat closes when it ends
    // between rounds: a bet already placed is returned
    const stack = s.stack + s.pending, buyin = s.buyin
    this.seats[i] = this.empty()
    this.onCashout?.(id, stack, buyin)
    this.reassignHost(); this.emit(); this.drive()
  }
  setOut(id: string, out: boolean) { const s = this.seats[this.seatOf(id)]; if (!s) return; s.out = out; if (!out) s.missed = 0; this.emit(); this.drive() }
  sweep(now = Date.now()): number {
    let waiting = 0
    for (const s of [...this.seats]) { if (!s.id || s.connected) continue; if (now - s.dcAt >= this.graceMs) this.standUp(s.id); else waiting++ }
    return waiting
  }

  // ---- the round ----
  private ready(s: BSeat) { return !!s.id && !s.out && s.stack + s.pending >= this.minBet }
  drive() {
    if (this.phase === 'wait' && this.autostart) this.startBetting()
  }
  private clearTimers() { if (this.timer) clearTimeout(this.timer); if (this.nextTimer) clearTimeout(this.nextTimer); this.timer = this.nextTimer = null; this.deadline = null }
  private startBetting() {
    if (!this.seats.some((s) => this.ready(s))) { this.emit(); return }
    this.clearTimers()
    for (const s of this.seats) { s.hands = []; s.inRound = false; if (s.id && s.pending > 0) { s.stack += s.pending; s.pending = 0 } }
    this.dealer = []; this.toAct = null
    this.phase = 'bet'
    // casual tables refill a busted stack for free
    for (const s of this.seats) if (s.id && this.config.casual && s.stack < this.minBet) { s.stack = this.casualStack; s.buyin += this.casualStack }
    if (this.betMs) { this.deadline = Date.now() + this.betMs; this.timer = setTimeout(() => this.deal(), this.betMs) }
    this.emit()
  }
  /** Place or change a bet during the betting window. */
  private placeBet(i: number, amount: number): string | null {
    const s = this.seats[i]
    if (this.phase !== 'bet') return 'not_betting'
    if (!Number.isInteger(amount) || amount < this.minBet || amount > this.maxBet || amount % 2 !== 0) return 'bad_amount'
    if (!this.ready(s)) return 'bad_amount'
    const avail = s.stack + s.pending
    if (amount > avail) return 'bad_amount'
    s.stack = avail - amount; s.pending = amount; s.missed = 0
    this.emit()
    const waiting = this.seats.filter((x) => this.ready(x))
    if (waiting.every((x) => x.pending > 0)) this.deal()
    return null
  }
  private draw(): number {
    if (this.shoe.length < 20) this.newShoe()
    return this.shoe.pop()!
  }
  private newShoe() {
    if (this.riggedShoe) { this.shoe = [...this.riggedShoe]; return }
    const cards: number[] = []
    for (let d = 0; d < DECKS; d++) cards.push(...shuffled())
    // one more shuffle across the whole shoe
    this.shoe = shuffled2(cards)
  }
  private deal() {
    if (this.phase !== 'bet') return
    this.clearTimers()
    if (!this.riggedShoe && this.shoe.length < DECKS * 52 * 0.25) this.newShoe()
    if (this.riggedShoe && this.shoe.length === 0) this.newShoe()
    const players = this.seats.map((s, i) => ({ s, i })).filter((x) => x.s.id && x.s.pending > 0)
    // seats that skipped the betting window miss a round; three in a row sits them out
    for (const s of this.seats) if (s.id && !s.out && s.pending === 0 && this.ready(s)) { s.missed++; if (s.missed >= 3) s.out = true }
    if (players.length === 0) { this.phase = 'wait'; this.emit(); this.drive(); return }
    this.round++
    for (const { s } of players) { s.inRound = true; s.hands = [{ cards: [], bet: s.pending, doubled: false, done: false, fromSplit: false, net: 0 }]; s.pending = 0 }
    for (let r = 0; r < 2; r++) { for (const { s } of players) s.hands[0].cards.push(this.draw()); this.dealer.push(this.draw()) }
    // the dealer peeks: a natural ends the round at once
    const up = cardValue(this.dealer[0])
    if ((up === 10 || up === 11) && isNatural(this.dealer)) { this.phase = 'dealer'; this.emit(); return this.settle() }
    for (const { s } of players) if (isNatural(s.hands[0].cards)) s.hands[0].done = true
    this.phase = 'play'
    this.toAct = null
    this.advance()
  }
  /** Move to the next hand that still needs a decision, or on to the dealer. */
  private advance() {
    const cur = this.toAct
    let seat = cur ? cur.seat : 0, hand = cur ? cur.hand : -1
    for (let guard = 0; guard < 40; guard++) {
      hand++
      const s = this.seats[seat]
      if (!s || !s.inRound || hand >= s.hands.length) { seat++; hand = -1; if (seat >= this.seats.length) { this.toAct = null; return this.dealerPlay() }; continue }
      const h = s.hands[hand]
      if (h.done) continue
      this.toAct = { seat, hand }
      this.armTimer(); this.emit(); this.autoPlay()
      return
    }
  }
  private afterTurnChange() {
    // a seat just became unavailable (left or went away): if it is their turn, stand for them
    this.emit(); this.autoPlay()
  }
  private armTimer() {
    this.deadline = null
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (!this.turnTimerMs || !this.toAct) return
    const t = this.toAct
    this.deadline = Date.now() + this.turnTimerMs
    this.timer = setTimeout(() => {
      if (!this.toAct || this.toAct.seat !== t.seat || this.toAct.hand !== t.hand) return
      const s = this.seats[t.seat]; s.missed++
      this.stand(t.seat, t.hand)
      if (s.missed >= 2) s.out = true
    }, this.turnTimerMs)
  }
  private autoPlay() {
    if (!this.toAct || this.phase !== 'play') return
    const t = this.toAct, s = this.seats[t.seat]
    if (!s.id || s.out || (!s.connected && Date.now() - s.dcAt >= 1500)) setTimeout(() => { if (this.toAct && this.toAct.seat === t.seat && this.toAct.hand === t.hand) this.stand(t.seat, t.hand) }, this.resultMs === 0 ? 0 : 400)
    else if (!s.connected) setTimeout(() => this.autoPlay(), 1600)
  }

  act(id: string, a: BjAct | unknown): string | null {
    if (!a || typeof a !== 'object') return 'bad_action'
    const act = a as BjAct
    const i = this.seatOf(id)
    if (i < 0) return 'not_seated'
    if (act.a === 'bet') return this.placeBet(i, Math.floor(Number(act.amount)))
    if (this.phase !== 'play' || !this.toAct || this.toAct.seat !== i) return 'not_your_turn'
    const t = this.toAct, s = this.seats[i], h = s.hands[t.hand]
    s.missed = 0
    const opts = this.options(i, t.hand)
    if (act.a === 'stand') { this.stand(i, t.hand); return null }
    if (act.a === 'hit') { if (!opts.hit) return 'cannot_hit'; h.cards.push(this.draw()); if (total(h.cards).sum >= 21) h.done = true; this.emit(); if (h.done) this.advance(); else { this.armTimer(); this.emit() } return null }
    if (act.a === 'double') {
      if (!opts.double) return 'cannot_double'
      s.stack -= h.bet; h.bet *= 2; h.doubled = true; h.cards.push(this.draw()); h.done = true
      this.emit(); this.advance(); return null
    }
    if (act.a === 'split') {
      if (!opts.split) return 'cannot_split'
      const second: Hand = { cards: [h.cards.pop()!], bet: h.bet, doubled: false, done: false, fromSplit: true, net: 0 }
      s.stack -= h.bet; h.fromSplit = true
      h.cards.push(this.draw()); second.cards.push(this.draw())
      s.hands.splice(t.hand + 1, 0, second)
      const aces = rankOf(h.cards[0]) === 12
      if (aces) { h.done = true; second.done = true } // split aces take one card each
      else { if (total(h.cards).sum === 21) h.done = true; if (total(second.cards).sum === 21) second.done = true }
      this.emit()
      if (h.done) this.advance(); else { this.armTimer(); this.emit() }
      return null
    }
    return 'bad_action'
  }
  private stand(i: number, hand: number) {
    const s = this.seats[i]; if (!s || !s.hands[hand]) return
    s.hands[hand].done = true
    this.advance()
  }
  /** What the hand to act may do. */
  options(i: number, hand: number) {
    const s = this.seats[i], h = s.hands[hand]
    if (!h) return { hit: false, stand: false, double: false, split: false }
    const two = h.cards.length === 2
    const splitAces = h.fromSplit && rankOf(h.cards[0]) === 12
    return {
      hit: !h.done && !splitAces,
      stand: !h.done,
      double: !h.done && two && s.stack >= h.bet && !splitAces,
      split: !h.done && two && s.hands.length === 1 && s.stack >= h.bet && cardValue(h.cards[0]) === cardValue(h.cards[1]) && !h.fromSplit,
    }
  }

  private dealerPlay() {
    this.phase = 'dealer'
    this.clearTimers()
    const live = this.seats.some((s) => s.inRound && s.hands.some((h) => total(h.cards).sum <= 21 && !(isNatural(h.cards) && !h.fromSplit)))
    const step = () => {
      const t = total(this.dealer)
      if (live && t.sum < 17) { this.dealer.push(this.draw()); this.emit(); if (this.resultMs === 0) step(); else this.timer = setTimeout(step, 700); return }
      this.settle()
    }
    this.emit()
    if (this.resultMs === 0) step(); else this.timer = setTimeout(step, 700)
  }
  private settle() {
    this.clearTimers()
    const dealerSum = total(this.dealer).sum
    const dealerNatural = isNatural(this.dealer)
    const net = this.seats.map(() => 0)
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i]
      if (!s.inRound) continue
      for (const h of s.hands) {
        const sum = total(h.cards).sum
        const natural = isNatural(h.cards) && !h.fromSplit
        let outcome: Outcome, back = 0
        if (sum > 21) { outcome = 'bust' }
        else if (natural && !dealerNatural) { outcome = 'blackjack'; back = h.bet + (h.bet * 3) / 2 }
        else if (dealerNatural) { outcome = natural ? 'push' : 'lose'; back = natural ? h.bet : 0 }
        else if (dealerSum > 21 || sum > dealerSum) { outcome = 'win'; back = h.bet * 2 }
        else if (sum === dealerSum) { outcome = 'push'; back = h.bet }
        else outcome = 'lose'
        h.outcome = outcome; h.net = back - h.bet
        s.stack += back
        net[i] += h.net
      }
    }
    this.phase = 'result'; this.toAct = null
    this.onHand?.({
      handNo: this.round, rule: `min ${this.minBet}`, net,
      seats: this.seats.map((s, i) => ({ seat: i, id: s.inRound ? s.id : null, name: s.name })),
      summary: { dealer: this.dealer, hands: this.seats.map((s) => (s.inRound ? s.hands.map((h) => ({ cards: h.cards, bet: h.bet, outcome: h.outcome })) : null)) },
    })
    this.emit()
    if (this.resultMs === 0) this.afterResult(); else { this.nextAt = Date.now() + this.resultMs; this.nextTimer = setTimeout(() => this.afterResult(), this.resultMs) }
  }
  private afterResult() {
    this.nextAt = null
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i]
      if (s.leaveAfter && s.id) { const id = s.id, stack = s.stack, buyin = s.buyin; this.seats[i] = this.empty(); this.onCashout?.(id, stack, buyin); continue }
      s.inRound = false
      if (s.id && s.stack < this.minBet && !this.config.casual) s.out = true
    }
    this.reassignHost()
    this.phase = 'wait'
    this.emit(); this.drive()
  }
  dispose() { this.clearTimers(); this.listeners.clear() }

  // ---- views ----
  view(id: string): BjView {
    const you = this.seatOf(id)
    const hideHole = this.phase === 'bet' || this.phase === 'play'
    return {
      config: this.config, you, host: this.hostId === id, phase: this.phase, round: this.round,
      dealer: { cards: this.dealer.map((c, i) => (i === 1 && hideHole ? null : c)), value: this.dealer.length ? (hideHole ? cardValue(this.dealer[0]) : total(this.dealer).sum) : null },
      seats: this.seats.map((s, i) => ({
        seat: i, name: s.name, stack: s.stack, pending: s.pending, inRound: s.inRound, empty: !s.id, me: i === you, out: s.out, connected: s.connected,
        hands: s.hands.map((h) => ({ ...h, ...(() => { const t = total(h.cards); return { value: t.sum, soft: t.soft } })() })),
      })),
      toAct: this.toAct,
      options: you >= 0 && this.phase === 'play' && this.toAct && this.toAct.seat === you ? this.options(you, this.toAct.hand) : null,
      betLimits: { min: this.minBet, max: Math.min(this.maxBet, you >= 0 ? this.seats[you].stack + this.seats[you].pending : this.maxBet) },
      canBet: you >= 0 && this.phase === 'bet' && this.ready(this.seats[you]),
      timeLeft: this.deadline && (this.phase === 'bet' ? you >= 0 : this.toAct?.seat === you) ? Math.max(0, this.deadline - Date.now()) : null,
      nextIn: this.nextAt ? Math.max(0, this.nextAt - Date.now()) : null,
      buyin: { min: this.minBuyin, max: this.maxBuyin }, yourBuyin: you >= 0 ? this.seats[you].buyin : 0,
      spectators: [...this.members].filter((m) => this.seatOf(m) < 0).length,
    }
  }

  serialize(): string {
    return JSON.stringify({ v: 1, config: this.config, hostId: this.hostId, phase: this.phase, round: this.round, shoe: this.shoe, dealer: this.dealer, toAct: this.toAct, seats: this.seats })
  }
  restore(json: string) {
    const d = JSON.parse(json)
    if (!d || d.v !== 1) return
    Object.assign(this, { config: d.config, hostId: d.hostId, phase: d.phase, round: d.round, shoe: d.shoe, dealer: d.dealer, toAct: d.toAct })
    this.seats = (d.seats as BSeat[]).map((s) => ({ ...s, connected: false, dcAt: s.id ? Date.now() : 0 }))
    this.members.clear()
    if (this.phase === 'bet') { this.phase = 'wait'; for (const s of this.seats) if (s.pending > 0) { s.stack += s.pending; s.pending = 0 } this.drive() }
    else if (this.phase === 'play') { this.armTimer(); this.autoPlay() }
    else if (this.phase === 'dealer') this.settle()
    else if (this.phase === 'result') { this.nextAt = Date.now() + this.resultMs; this.nextTimer = setTimeout(() => this.afterResult(), this.resultMs) }
    else this.drive()
  }
}

function shuffled2(cards: number[]): number[] {
  const d = [...cards]
  for (let i = d.length - 1; i > 0; i--) { const a = new Uint32Array(1); crypto.getRandomValues(a); const j = a[0] % (i + 1); [d[i], d[j]] = [d[j], d[i]] }
  return d
}

export function makeBlackjack(bet: number | undefined, casual: boolean): BlackjackTable {
  const t = new BlackjackTable({ bet: MIN_BETS.includes(bet ?? 0) ? bet! : DEFAULT_BJ.bet, casual, maxSeats: 6 })
  return t
}
