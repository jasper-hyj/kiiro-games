import { shuffled } from '../../holdem/engine/cards'
import { allCombos, beats, evalCombo, penalty, power, THREE_DIAMONDS, type Combo } from './combos'

export interface BtConfig { ranked: boolean }
export interface BtSeat { id: string | null; name: string; bot: boolean; connected: boolean; dcAt: number; hand: number[]; passed: boolean; missed: number }
export interface BtPlay { seat: number; cards: number[]; type: string }
export interface BtResult { winner: number; left: number[]; points: number[]; /** chips are decided by the server from these */ hands: number[][] }
export interface BtView {
  config: BtConfig; status: 'lobby' | 'playing' | 'over'; you: number; host: boolean
  seats: { seat: number; name: string; bot: boolean; connected: boolean; count: number; passed: boolean; empty: boolean; me: boolean }[]
  hand: number[]
  turn: number
  /** the combination currently to beat (null when you lead) */
  current: { seat: number; cards: number[]; type: string } | null
  last: BtPlay[]
  mustOpen: boolean
  canPass: boolean
  timeLeft: number | null
  result: BtResult | null
  game: number
}

const clean = (s: unknown, n = 16) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n)

/** Four-player Big Two. Empty seats are bots; a game is a single deal and ends when someone goes out. */
export class BigTwoTable {
  config: BtConfig = { ranked: false }
  seats: BtSeat[] = Array.from({ length: 4 }, () => this.empty())
  hostId: string | null = null
  status: 'lobby' | 'playing' | 'over' = 'lobby'
  turn = -1
  current: { seat: number; combo: Combo } | null = null
  lead = -1
  opening = true
  last: BtPlay[] = []
  result: BtResult | null = null
  gameNo = 0
  matchId: string | null = null
  startedAt = 0
  listeners = new Set<() => void>()
  /** per-turn limit in ms (0 = off) */
  turnTimerMs = 45000
  botDelayMs = 900
  graceMs = 8000
  /** random seat order at the start of every game (tests switch this off) */
  shuffleSeats = true
  /** tests: deal exactly these four hands */
  riggedHands: number[][] | null = null
  onOver: ((t: BigTwoTable) => void) | null = null
  private deadline: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  private empty(): BtSeat { return { id: null, name: '', bot: false, connected: false, dcAt: 0, hand: [], passed: false, missed: 0 } }
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit() { this.listeners.forEach((f) => f()) }
  seatOf(id: string) { return this.seats.findIndex((s) => s.id === id) }
  hasPlayers() { return this.seats.some((s) => s.id) }

  admit(id: string, create: boolean): 'ok' | 'code_taken' | 'room_not_found' {
    if (this.seatOf(id) >= 0) return 'ok'
    if (create) return this.hasPlayers() ? 'code_taken' : 'ok'
    return this.hasPlayers() ? 'ok' : 'room_not_found'
  }
  join(id: string, name: string): number {
    let i = this.seatOf(id)
    if (i < 0) i = this.seats.findIndex((s) => !s.id && (this.status !== 'playing' || s.bot))
    if (i < 0) return -1
    const s = this.seats[i]
    s.id = id; s.name = clean(name) || 'Player'; s.connected = true; s.dcAt = 0; s.bot = false
    if (!this.hostId || this.seatOf(this.hostId) < 0) this.hostId = id
    this.emit(); this.drive()
    return i
  }
  leave(id: string, deliberate = false) {
    const i = this.seatOf(id)
    if (i < 0) return
    if (this.status !== 'playing') {
      this.seats[i] = this.empty()
      if (this.hostId === id) this.hostId = this.seats.find((s) => s.id)?.id ?? null
    } else {
      this.seats[i].connected = false; this.seats[i].dcAt = deliberate ? 0 : Date.now()
      if (this.hostId === id) { const next = this.seats.find((s) => s.id && s.connected); if (next) this.hostId = next.id }
      setTimeout(() => { this.emit(); this.drive() }, this.graceMs + 20)
    }
    this.emit(); this.drive()
  }
  setConfig(id: string, c: Partial<BtConfig>) {
    if (id !== this.hostId || this.status !== 'lobby') return
    if (typeof c.ranked === 'boolean') this.config.ranked = c.ranked
    this.emit()
  }

  start(id?: string) {
    if (id !== undefined && id !== this.hostId) return
    if (this.status === 'playing') return
    this.status = 'playing'
    this.gameNo++
    this.matchId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    this.startedAt = Date.now()
    this.result = null; this.last = []; this.current = null; this.opening = true
    let n = 1
    for (const s of this.seats) { if (!s.id) { s.bot = true; s.name = 'Bot ' + n++; s.connected = true } s.passed = false; s.missed = 0 }
    // random seat order so nobody is always first
    if (this.shuffleSeats) for (let i = this.seats.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.seats[i], this.seats[j]] = [this.seats[j], this.seats[i]] }
    const deck = shuffled()
    for (let i = 0; i < 4; i++) this.seats[i].hand = this.riggedHands ? [...this.riggedHands[i]] : deck.slice(i * 13, i * 13 + 13)
    this.seats.forEach((s) => s.hand.sort((a, b) => power(a) - power(b)))
    this.turn = this.seats.findIndex((s) => s.hand.includes(THREE_DIAMONDS))
    this.lead = this.turn
    this.emit(); this.armTimer(); this.drive()
  }
  backToLobby(id: string) {
    if (id !== this.hostId || this.status !== 'over') return
    this.status = 'lobby'; this.result = null
    for (const s of this.seats) { if (s.bot) this.seats[this.seats.indexOf(s)] = this.empty(); }
    for (const s of this.seats) { s.hand = []; s.passed = false }
    this.emit()
  }

  // ---- play ----
  /** Check a play for the seat whose turn it is; returns an error code or the combo. */
  check(seat: number, cards: number[]): string | Combo {
    const s = this.seats[seat]
    if (this.status !== 'playing' || this.turn !== seat) return 'not_your_turn'
    if (!Array.isArray(cards) || cards.length === 0 || cards.some((c) => !Number.isInteger(c) || !s.hand.includes(c))) return 'bad_cards'
    const combo = evalCombo(cards)
    if (!combo) return 'bad_combo'
    if (this.opening && !cards.includes(THREE_DIAMONDS)) return 'must_open'
    if (!beats(combo, this.current ? this.current.combo : null)) return 'too_low'
    return combo
  }
  play(id: string, cards: number[]): string | null {
    const i = this.seatOf(id)
    if (i < 0) return 'not_seated'
    const r = this.check(i, cards)
    if (typeof r === 'string') return r
    this.seats[i].missed = 0
    this.apply(i, r)
    return null
  }
  pass(id: string): string | null {
    const i = this.seatOf(id)
    if (i < 0) return 'not_seated'
    if (this.status !== 'playing' || this.turn !== i) return 'not_your_turn'
    if (!this.current) return 'must_lead'
    this.seats[i].missed = 0
    this.doPass(i)
    return null
  }
  private apply(i: number, combo: Combo) {
    const s = this.seats[i]
    s.hand = s.hand.filter((c) => !combo.cards.includes(c))
    this.current = { seat: i, combo }; this.opening = false
    this.last.push({ seat: i, cards: combo.cards, type: combo.type }); if (this.last.length > 12) this.last.shift()
    for (const x of this.seats) x.passed = false
    if (s.hand.length === 0) return this.finish(i)
    this.turn = (i + 1) % 4
    this.armTimer(); this.emit(); this.drive()
  }
  private doPass(i: number) {
    this.seats[i].passed = true
    this.last.push({ seat: i, cards: [], type: 'pass' }); if (this.last.length > 12) this.last.shift()
    // when everyone else has passed, the last player to play leads a fresh trick
    const cur = this.current!.seat
    let next = (i + 1) % 4
    if (next === cur) { this.current = null; for (const x of this.seats) x.passed = false }
    this.turn = next
    this.armTimer(); this.emit(); this.drive()
  }
  private finish(winner: number) {
    this.clearTimer()
    const left = this.seats.map((s) => s.hand.length)
    const points = left.map((l, i) => (i === winner ? 0 : -penalty(l)))
    points[winner] = -points.reduce((a, b) => a + b, 0)
    this.result = { winner, left, points, hands: this.seats.map((s) => [...s.hand]) }
    this.status = 'over'; this.turn = -1
    this.emit()
    this.onOver?.(this)
  }

  // ---- timers and bots ----
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; this.deadline = null }
  private armTimer() {
    this.clearTimer()
    if (this.status !== 'playing' || this.turn < 0 || !this.turnTimerMs) return
    const i = this.turn
    if (this.seats[i].bot) return
    this.deadline = Date.now() + this.turnTimerMs
    this.timer = setTimeout(() => { if (this.turn === i && this.status === 'playing') { this.seats[i].missed++; this.autoMove(i) } }, this.turnTimerMs)
  }
  /** A seat with nobody behind it (gone for good, or timed out twice) is played like a bot. */
  private botControlled(i: number) { const s = this.seats[i]; return s.bot || s.missed >= 2 || (!s.connected && Date.now() - s.dcAt >= this.graceMs) }
  drive() {
    if (this.status !== 'playing' || this.turn < 0) return
    const i = this.turn
    if (!this.botControlled(i)) return
    const wait = this.botDelayMs
    const tick = () => { if (this.status === 'playing' && this.turn === i) this.autoMove(i) }
    if (wait === 0) tick(); else setTimeout(tick, wait)
  }
  private autoMove(i: number) {
    const move = chooseMove(this.seats[i].hand, this.current ? this.current.combo : null, this.opening)
    if (move) { const r = this.check(i, move.cards); if (typeof r !== 'string') return this.apply(i, r) }
    if (this.current) this.doPass(i)
    else { // must lead: play the lowest single as a last resort
      const c = this.seats[i].hand[0]; const r = this.check(i, [c]); if (typeof r !== 'string') this.apply(i, r)
    }
  }

  // ---- view ----
  view(id: string): BtView {
    const you = this.seatOf(id)
    return {
      config: this.config, status: this.status, you, host: this.hostId === id, game: this.gameNo,
      seats: this.seats.map((s, i) => ({ seat: i, name: s.name, bot: s.bot, connected: s.connected, count: s.hand.length, passed: s.passed, empty: !s.id && !s.bot, me: i === you })),
      hand: you >= 0 ? this.seats[you].hand : [],
      turn: this.turn,
      current: this.current ? { seat: this.current.seat, cards: this.current.combo.cards, type: this.current.combo.type } : null,
      last: this.last, mustOpen: this.opening && this.turn === you,
      canPass: this.status === 'playing' && this.turn === you && !!this.current,
      timeLeft: this.deadline && this.turn === you ? Math.max(0, this.deadline - Date.now()) : null,
      result: this.result,
    }
  }

  serialize(): string {
    return JSON.stringify({ v: 1, config: this.config, hostId: this.hostId, status: this.status, turn: this.turn, current: this.current, lead: this.lead, opening: this.opening, last: this.last, result: this.result, gameNo: this.gameNo, matchId: this.matchId, startedAt: this.startedAt, seats: this.seats })
  }
  restore(json: string) {
    const d = JSON.parse(json)
    if (!d || d.v !== 1) return
    Object.assign(this, { config: d.config, hostId: d.hostId, status: d.status, turn: d.turn, current: d.current, lead: d.lead, opening: d.opening, last: d.last, result: d.result, gameNo: d.gameNo, matchId: d.matchId, startedAt: d.startedAt })
    this.seats = (d.seats as BtSeat[]).map((s) => ({ ...s, connected: s.bot, dcAt: s.id ? Date.now() : 0 }))
    if (this.status === 'playing') { this.armTimer(); this.drive() }
  }
  dispose() { this.clearTimer(); this.listeners.clear() }
}

/** A simple, sensible bot: lead the lowest group, beat with the weakest legal combination, keep 2s when it can. */
export function chooseMove(hand: number[], current: Combo | null, opening: boolean): Combo | null {
  let options = allCombos(hand)
  if (opening) options = options.filter((c) => c.cards.includes(THREE_DIAMONDS))
  if (current) options = options.filter((c) => beats(c, current))
  if (options.length === 0) return null
  if (current) return options.sort((a, b) => a.key - b.key || a.cards.length - b.cards.length)[0]
  // leading: prefer shedding more cards at once, lowest first (five-card hands only when they are not strong)
  const rank = (c: Combo) => (c.size === 5 ? 0 : c.size === 3 ? 1 : c.size === 2 ? 2 : 3)
  return options.sort((a, b) => rank(a) - rank(b) || a.key - b.key)[0]
}
