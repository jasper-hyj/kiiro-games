import { shuffled } from './cards'
import { best, categoryOf } from './eval'

export interface PokerConfig {
  sb: number; bb: number
  /** casual tables use free temporary stacks that never touch the chip ledger (guests welcome); cash tables buy in from a signed-in balance */
  casual: boolean
  maxSeats: number
}
export const DEFAULT_POKER: PokerConfig = { sb: 25, bb: 50, casual: true, maxSeats: 6 }
export const MIN_BUYIN_BB = 20
export const MAX_BUYIN_BB = 100
export const BLINDS: [number, number][] = [[5, 10], [10, 20], [25, 50], [50, 100], [100, 200], [250, 500]]

export type Street = 'wait' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export interface PSeat {
  id: string | null; name: string; stack: number; bet: number; total: number
  folded: boolean; allIn: boolean; hole: number[]; acted: boolean
  /** may not re-raise this round (a short all-in raise did not reopen the betting for them) */
  locked: boolean
  /** sitting out: dealt no cards until they come back */
  out: boolean; connected: boolean; missed: number; dcAt: number
  /** chips taken from the ledger and not yet returned (cash tables) */
  buyin: number
  /** was dealt into the current hand */
  inHand: boolean
  last: string
}
export type PokerAct = { a: 'fold' } | { a: 'check' } | { a: 'call' } | { a: 'raise'; to: number } | { a: 'allin' }
export interface Pot { amount: number; eligible: number[] }
export interface HandResult {
  handNo: number
  /** per seat: chips won (0 for others) */
  won: number[]
  /** per seat: net change this hand */
  net: number[]
  pots: { amount: number; winners: number[] }[]
  shown: { seat: number; hole: number[]; name: string; cat: number }[]
  board: number[]
  /** hand ended because everyone else folded */
  byFold: boolean
}
export interface PokerView {
  config: PokerConfig
  you: number
  host: boolean
  street: Street
  handNo: number
  board: number[]
  pot: number
  button: number
  toAct: number
  seats: { seat: number; name: string; stack: number; bet: number; folded: boolean; allIn: boolean; out: boolean; connected: boolean; dealt: boolean; hole: number[] | null; last: string; empty: boolean; me: boolean }[]
  spectators: number
  /** your options when it is your turn */
  turn: null | { call: number; canCheck: boolean; minRaiseTo: number; maxRaiseTo: number; canRaise: boolean }
  timeLeft: number | null
  result: HandResult | null
  /** next hand starts in this many ms (null when not counting down) */
  nextIn: number | null
  buyin: { min: number; max: number }
  yourBuyin: number
}

type Listener = () => void
const clean = (s: unknown, n = 16) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n)

export class PokerTable {
  config: PokerConfig
  seats: PSeat[] = []
  members = new Set<string>()
  hostId: string | null = null
  street: Street = 'wait'
  board: number[] = []
  deck: number[] = []
  button = -1
  toAct = -1
  currentBet = 0
  minRaise = 0
  handNo = 0
  result: HandResult | null = null
  listeners = new Set<Listener>()
  /** called when a player's seat is closed: gives back the chips they still hold (the server credits the ledger) */
  onCashout: ((id: string, stack: number, buyin: number) => void) | null = null
  /** called when a hand finishes (the server records it) */
  onHand: ((r: HandResult, seats: PSeat[]) => void) | null = null
  /** per-decision limit in ms (0 = off). After two timeouts in a row the player is sat out. */
  turnTimerMs = 30000
  /** ms to show a finished hand before the next one starts (0 = immediately, for tests) */
  resultMs = 6000
  graceMs = 60000
  /** tests set this false to seat everyone before the first hand */
  autostart = true
  /** random source for shuffling (tests inject a seeded one) */
  rand?: (n: number) => number
  /** tests: deal from this exact deck (cards are taken from the end) instead of shuffling */
  riggedDeck: number[] | null = null
  private deadline: number | null = null
  private nextAt: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private nextTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: PokerConfig = DEFAULT_POKER) {
    this.config = { ...config }
    this.seats = Array.from({ length: this.config.maxSeats }, () => this.empty())
  }
  private empty(): PSeat {
    return { id: null, name: '', stack: 0, bet: 0, total: 0, folded: false, allIn: false, hole: [], acted: false, locked: false, out: false, connected: false, missed: 0, dcAt: 0, buyin: 0, inHand: false, last: '' }
  }
  onChange(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit() { this.listeners.forEach((f) => f()) }

  get minBuyin() { return this.config.bb * MIN_BUYIN_BB }
  get maxBuyin() { return this.config.bb * MAX_BUYIN_BB }
  seatOf(id: string) { return this.seats.findIndex((s) => s.id === id) }
  hasPlayers() { return this.members.size > 0 || this.seats.some((s) => s.id) }

  // ---------- room membership ----------
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
  /** a connection dropped. A seated player keeps the seat for a grace period and is folded/checked automatically meanwhile. */
  disconnect(id: string) {
    this.members.delete(id)
    const i = this.seatOf(id)
    if (i >= 0) {
      this.seats[i].connected = false; this.seats[i].dcAt = Date.now()
      setTimeout(() => { const s = this.seats[i]; if (s.id === id && !s.connected) this.standUp(id) }, this.graceMs + 50)
    }
    this.reassignHost()
    this.emit(); this.drive()
  }
  private reassignHost() {
    if (this.hostId && (this.members.has(this.hostId) || this.seatOf(this.hostId) >= 0)) return
    this.hostId = [...this.members][0] ?? this.seats.find((s) => s.id)?.id ?? null
  }

  /** Take a seat with `amount` chips. The caller has already secured the chips (ledger hold, or a free casual stack). */
  sit(id: string, name: string, amount: number): { ok: true; seat: number } | { ok: false; error: string } {
    if (this.seatOf(id) >= 0) return { ok: false, error: 'already_seated' }
    if (!Number.isInteger(amount) || amount < this.minBuyin || amount > this.maxBuyin) return { ok: false, error: 'bad_buyin' }
    const i = this.seats.findIndex((s) => !s.id)
    if (i < 0) return { ok: false, error: 'table_full' }
    const s = this.seats[i]
    Object.assign(s, this.empty(), { id, name: clean(name) || 'Player', stack: amount, buyin: amount, connected: true, out: false })
    this.members.add(id)
    if (!this.hostId) this.hostId = id
    this.emit(); this.drive()
    return { ok: true, seat: i }
  }
  /** Add chips between hands (never above the maximum buy-in). */
  rebuy(id: string, amount: number): boolean {
    const s = this.seats[this.seatOf(id)]
    if (!s || !Number.isInteger(amount) || amount <= 0) return false
    if (s.inHand && this.street !== 'showdown' && this.street !== 'wait') return false
    if (s.stack + amount > this.maxBuyin) return false
    s.stack += amount; s.buyin += amount; s.out = false; s.missed = 0
    this.emit(); this.drive()
    return true
  }
  /** How many chips a rebuy may add right now. */
  rebuyRoom(id: string): number {
    const s = this.seats[this.seatOf(id)]
    if (!s) return 0
    if (s.inHand && this.street !== 'showdown' && this.street !== 'wait') return 0
    return Math.max(0, this.maxBuyin - s.stack)
  }
  /** Leave the seat. In a live hand the player folds first; their chips go back through onCashout. */
  standUp(id: string) {
    const i = this.seatOf(id)
    if (i < 0) return
    const s = this.seats[i]
    if (s.inHand && !s.folded && this.street !== 'showdown' && this.street !== 'wait') {
      if (this.toAct === i) this.apply(i, { a: 'fold' })
      else { s.folded = true; s.last = 'fold'; this.afterChange(true) }
    }
    // chips already committed to the pot stay there; only the stack goes home
    const stack = this.seats[i].stack, buyin = this.seats[i].buyin
    const inPotNow = this.seats[i].inHand && this.street !== 'wait' && this.street !== 'showdown'
    if (inPotNow) { this.seats[i].id = null; this.seats[i].stack = 0; this.seats[i].out = true } else this.seats[i] = this.empty()
    this.onCashout?.(id, stack, buyin)
    this.reassignHost()
    this.emit(); this.drive()
  }
  setOut(id: string, out: boolean) {
    const s = this.seats[this.seatOf(id)]
    if (!s) return
    s.out = out; if (!out) s.missed = 0
    this.emit(); this.drive()
  }

  // ---------- the hand ----------
  private live(i: number) { const s = this.seats[i]; return !!s.id && s.inHand && !s.folded }
  private canBet(i: number) { return this.live(i) && !this.seats[i].allIn }
  private nextSeat(from: number, pred: (i: number) => boolean): number {
    const n = this.seats.length
    for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (pred(i)) return i }
    return -1
  }
  private ready(i: number) { const s = this.seats[i]; return !!s.id && !s.out && s.stack > 0 }

  /** Start the next hand if two or more players can play. */
  private startHand() {
    if (this.street !== 'wait' && this.street !== 'showdown') return
    const ready = this.seats.map((_, i) => i).filter((i) => this.ready(i))
    if (ready.length < 2) { this.street = 'wait'; this.result = null; this.emit(); return }
    this.clearTimers()
    this.handNo++
    this.result = null
    this.board = []
    this.deck = this.riggedDeck ? [...this.riggedDeck] : shuffled(this.rand)
    for (const s of this.seats) { s.bet = 0; s.total = 0; s.folded = false; s.allIn = false; s.hole = []; s.acted = false; s.locked = false; s.inHand = false; s.last = '' }
    for (const i of ready) this.seats[i].inHand = true
    this.button = this.nextSeat(this.button < 0 ? ready[ready.length - 1] : this.button, (i) => this.seats[i].inHand)
    const heads = ready.length === 2
    const sb = heads ? this.button : this.nextSeat(this.button, (i) => this.seats[i].inHand)
    const bb = this.nextSeat(sb, (i) => this.seats[i].inHand)
    // two cards each, one at a time starting left of the button
    for (let r = 0; r < 2; r++) { let i = this.button; for (let k = 0; k < ready.length; k++) { i = this.nextSeat(i, (x) => this.seats[x].inHand); this.seats[i].hole.push(this.deck.pop()!) } }
    this.post(sb, this.config.sb, 'sb'); this.post(bb, this.config.bb, 'bb')
    this.street = 'preflop'
    this.currentBet = this.config.bb
    this.minRaise = this.config.bb
    // the big blind still gets the option, so nobody counts as having acted yet
    this.toAct = this.nextSeat(bb, (i) => this.canBet(i))
    this.armTimer()
    this.emit()
    if (this.toAct < 0) this.afterChange(); else this.autoPlay()
  }
  private post(i: number, amount: number, tag: string) {
    const s = this.seats[i]
    const pay = Math.min(s.stack, amount)
    s.stack -= pay; s.bet += pay; s.total += pay; s.last = tag
    if (s.stack === 0) s.allIn = true
  }

  /** What the player to act may do. */
  turnInfo(i: number) {
    const s = this.seats[i]
    const call = Math.min(s.stack, this.currentBet - s.bet)
    const maxTo = s.bet + s.stack
    const minTo = Math.min(maxTo, this.currentBet + this.minRaise)
    // raising is only offered if someone else could still respond to it
    const others = this.seats.some((o, j) => j !== i && this.canBet(j))
    return { call, canCheck: this.currentBet === s.bet, minRaiseTo: minTo, maxRaiseTo: maxTo, canRaise: !s.locked && maxTo > this.currentBet && others }
  }

  /** A player's action. Returns an error code or null. */
  act(id: string, a: PokerAct): string | null {
    const i = this.seatOf(id)
    if (i < 0) return 'not_seated'
    if (this.street === 'wait' || this.street === 'showdown') return 'not_your_turn'
    if (this.toAct !== i) return 'not_your_turn'
    const s = this.seats[i]; s.missed = 0
    return this.apply(i, a)
  }
  private apply(i: number, a: PokerAct): string | null {
    const s = this.seats[i]
    const info = this.turnInfo(i)
    if (a.a === 'fold') { s.folded = true; s.last = 'fold' }
    else if (a.a === 'check') { if (!info.canCheck) return 'cannot_check'; s.last = 'check' }
    else if (a.a === 'call') {
      if (info.canCheck) { s.last = 'check' } else { s.stack -= info.call; s.bet += info.call; s.total += info.call; s.last = s.stack === 0 ? 'allin' : 'call'; if (s.stack === 0) s.allIn = true }
    } else if (a.a === 'allin' || a.a === 'raise') {
      const to = a.a === 'allin' ? s.bet + s.stack : Math.floor(Number((a as { to: number }).to))
      if (!Number.isFinite(to)) return 'bad_amount'
      if (to >= s.bet + s.stack) {
        // all-in: a call if it does not reach the bet (or if raising is not allowed), otherwise a raise (possibly short)
        const all = s.bet + s.stack
        if (all > this.currentBet && !info.canRaise) {
          const pay = Math.min(s.stack, this.currentBet - s.bet)
          s.stack -= pay; s.bet += pay; s.total += pay; s.last = s.stack === 0 ? 'allin' : 'call'; if (s.stack === 0) s.allIn = true
        } else if (all <= this.currentBet) { const pay = s.stack; s.stack = 0; s.bet += pay; s.total += pay; s.allIn = true; s.last = 'allin' }
        else this.raiseTo(i, all, true)
      } else {
        if (!info.canRaise) return 'cannot_raise'
        if (to < info.minRaiseTo || to > info.maxRaiseTo) return 'bad_amount'
        this.raiseTo(i, to, false)
      }
    }
    s.acted = true
    this.afterChange()
    return null
  }
  private raiseTo(i: number, to: number, allIn: boolean) {
    const s = this.seats[i]
    if (s.locked && !allIn) return
    const size = to - this.currentBet
    const full = size >= this.minRaise
    const pay = to - s.bet
    s.stack -= pay; s.bet = to; s.total += pay
    if (s.stack === 0) s.allIn = true
    s.last = allIn || s.allIn ? 'allin' : this.currentBet === 0 ? 'bet' : 'raise'
    const hadActed = (j: number) => this.seats[j].acted
    for (let j = 0; j < this.seats.length; j++) {
      if (j === i || !this.canBet(j)) continue
      // everyone must answer the new bet; a short all-in does not give players who already acted the right to raise again
      if (!full && hadActed(j)) this.seats[j].locked = true
      this.seats[j].acted = false
    }
    this.currentBet = to
    if (full) this.minRaise = size
    s.acted = true
  }

  private afterChange(keepTurn = false) {
    this.clearTimers()
    const alive = this.seats.map((_, i) => i).filter((i) => this.live(i))
    if (alive.length <= 1) return this.finish(true)
    const pending = alive.filter((i) => this.canBet(i) && (!this.seats[i].acted || this.seats[i].bet < this.currentBet))
    if (pending.length === 0) return this.nextStreet()
    if (!(keepTurn && pending.includes(this.toAct))) this.toAct = this.nextSeat(this.toAct, (i) => pending.includes(i))
    this.armTimer(); this.emit(); this.autoPlay()
  }
  private nextStreet() {
    for (const s of this.seats) { s.bet = 0; s.acted = false; s.locked = false; if (s.last !== 'fold' && s.last !== 'allin') s.last = '' }
    this.currentBet = 0; this.minRaise = this.config.bb
    const canAct = this.seats.map((_, i) => i).filter((i) => this.canBet(i))
    const deal = (n: number) => { this.deck.pop(); for (let k = 0; k < n; k++) this.board.push(this.deck.pop()!) } // burn one
    if (this.street === 'preflop') { this.street = 'flop'; deal(3) }
    else if (this.street === 'flop') { this.street = 'turn'; deal(1) }
    else if (this.street === 'turn') { this.street = 'river'; deal(1) }
    else return this.finish(false)
    // fewer than two players can still bet: nothing more to decide, run the board out
    if (canAct.length < 2) { this.emit(); return this.runOut() }
    this.toAct = this.nextSeat(this.button, (i) => this.canBet(i))
    this.armTimer(); this.emit(); this.autoPlay()
  }
  private runOut() {
    const step = () => this.nextStreetAuto()
    if (this.resultMs === 0) step(); else this.timer = setTimeout(step, 900)
  }
  private nextStreetAuto() {
    if (this.street === 'river') return this.finish(false)
    this.nextStreet()
  }

  /** Split the pot(s) and show the result. */
  private finish(byFold: boolean) {
    this.clearTimers()
    this.street = 'showdown'
    const n = this.seats.length
    const won = new Array(n).fill(0)
    const pots: HandResult['pots'] = []
    const contrib = this.seats.map((s) => s.total)
    const alive = this.seats.map((_, i) => i).filter((i) => this.live(i))
    const shown: HandResult['shown'] = []
    const scores = new Map<number, number>()
    if (!byFold) for (const i of alive) { const sc = best([...this.seats[i].hole, ...this.board]); scores.set(i, sc); shown.push({ seat: i, hole: this.seats[i].hole, name: this.seats[i].name, cat: categoryOf(sc) }) }
    // side pots from the contribution levels
    const levels = [...new Set(this.seats.filter((s) => s.total > 0).map((s) => s.total))].sort((a, b) => a - b)
    let prev = 0
    for (const lvl of levels) {
      const takers = this.seats.map((_, i) => i).filter((i) => contrib[i] >= lvl)
      const amount = (lvl - prev) * takers.length
      prev = lvl
      const eligible = takers.filter((i) => this.live(i))
      if (amount === 0) continue
      if (eligible.length === 0) { // everybody who paid this level folded: it goes to the next level's winners via the best live hand
        const fallback = alive[0]; won[fallback] += amount; pots.push({ amount, winners: [fallback] }); continue
      }
      let winners = eligible
      if (!byFold && eligible.length > 1) { const top = Math.max(...eligible.map((i) => scores.get(i)!)); winners = eligible.filter((i) => scores.get(i) === top) }
      const share = Math.floor(amount / winners.length)
      let odd = amount - share * winners.length
      // odd chips go to the winners closest to the left of the button
      const order = [...winners].sort((a, b) => ((a - this.button + n) % n) - ((b - this.button + n) % n))
      for (const w of order) { won[w] += share + (odd > 0 ? 1 : 0); if (odd > 0) odd-- }
      pots.push({ amount, winners })
    }
    const net = this.seats.map((s, i) => won[i] - s.total)
    for (let i = 0; i < n; i++) this.seats[i].stack += won[i]
    this.result = { handNo: this.handNo, won, net, pots, shown, board: [...this.board], byFold }
    for (const s of this.seats) { s.bet = 0 }
    this.toAct = -1
    this.onHand?.(this.result, this.seats)
    this.emit()
    this.scheduleNext()
  }
  private scheduleNext() {
    if (this.resultMs === 0) { this.afterHand(); return }
    this.nextAt = Date.now() + this.resultMs
    this.nextTimer = setTimeout(() => this.afterHand(), this.resultMs)
  }
  private afterHand() {
    this.nextAt = null
    // busted players (or ones who left mid-hand) are cleared; casual tables refill the stack for free
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i]
      if (!s.id) { this.seats[i] = this.empty(); continue }
      if (s.stack === 0 && this.config.casual) { s.stack = this.config.bb * MAX_BUYIN_BB; s.buyin += s.stack }
      if (s.stack === 0) s.out = true
      s.inHand = false
    }
    this.street = 'wait'
    this.emit()
    this.drive()
  }

  /** Move things along: start a hand when possible. */
  drive() {
    if (this.street === 'wait') { if (this.autostart) this.startHand() }
    else this.autoPlay()
  }

  // ---------- timers, disconnects ----------
  private armTimer() {
    this.deadline = null
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (!this.turnTimerMs || this.toAct < 0) return
    const i = this.toAct
    this.deadline = Date.now() + this.turnTimerMs
    this.timer = setTimeout(() => {
      const s = this.seats[i]
      if (this.toAct !== i || !s.id) return
      s.missed++
      this.apply(i, this.turnInfo(i).canCheck ? { a: 'check' } : { a: 'fold' })
      if (s.missed >= 2 && s.id) s.out = true
    }, this.turnTimerMs)
  }
  /** Players who are gone or sitting out never hold the table up: they check if free, otherwise fold. */
  private autoPlay() {
    if (this.toAct < 0 || (this.street === 'wait' || this.street === 'showdown')) return
    const i = this.toAct, s = this.seats[i]
    if (!s.id || s.out || (!s.connected && Date.now() - s.dcAt >= 1500)) {
      setTimeout(() => { if (this.toAct === i) this.apply(i, this.turnInfo(i).canCheck ? { a: 'check' } : { a: 'fold' }) }, this.resultMs === 0 ? 0 : 400)
    } else if (!s.connected) {
      setTimeout(() => this.autoPlay(), 1600)
    }
  }
  private clearTimers() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.nextTimer) { clearTimeout(this.nextTimer); this.nextTimer = null }
    this.deadline = null
  }
  /** Stop everything (room closed). */
  dispose() { this.clearTimers(); this.listeners.clear() }

  // ---------- views ----------
  view(id: string): PokerView {
    const you = this.seatOf(id)
    const reveal = this.street === 'showdown' && this.result && !this.result.byFold
    const shownSeats = new Set(this.result?.shown.map((x) => x.seat) ?? [])
    const turn = you >= 0 && this.toAct === you && this.street !== 'wait' && this.street !== 'showdown' ? this.turnInfo(you) : null
    return {
      config: this.config, you, host: this.hostId === id, street: this.street, handNo: this.handNo, board: [...this.board],
      pot: this.seats.reduce((a, s) => a + s.total, 0), button: this.button, toAct: this.toAct,
      seats: this.seats.map((s, i) => ({
        seat: i, name: s.name, stack: s.stack, bet: s.bet, folded: s.folded, allIn: s.allIn, out: s.out, connected: s.connected, dealt: s.inHand, last: s.last, empty: !s.id, me: i === you,
        hole: s.hole.length === 0 ? null : i === you || (reveal && shownSeats.has(i)) ? s.hole : [],
      })),
      spectators: [...this.members].filter((m) => this.seatOf(m) < 0).length,
      turn, timeLeft: this.deadline && this.toAct === you && you >= 0 ? Math.max(0, this.deadline - Date.now()) : null,
      result: this.result, nextIn: this.nextAt ? Math.max(0, this.nextAt - Date.now()) : null,
      buyin: { min: this.minBuyin, max: this.maxBuyin }, yourBuyin: you >= 0 ? this.seats[you].buyin : 0,
    }
  }

  // ---------- persistence ----------
  serialize(): string {
    return JSON.stringify({ v: 1, config: this.config, hostId: this.hostId, street: this.street, board: this.board, deck: this.deck, button: this.button, toAct: this.toAct, currentBet: this.currentBet, minRaise: this.minRaise, handNo: this.handNo, result: this.result, seats: this.seats })
  }
  restore(json: string) {
    const d = JSON.parse(json)
    if (!d || d.v !== 1) return
    Object.assign(this, { config: d.config, hostId: d.hostId, street: d.street, board: d.board, deck: d.deck, button: d.button, toAct: d.toAct, currentBet: d.currentBet, minRaise: d.minRaise, handNo: d.handNo, result: d.result })
    this.seats = (d.seats as PSeat[]).map((s) => ({ ...s, connected: false, dcAt: s.id ? Date.now() : 0 }))
    this.members.clear()
    if (this.street === 'showdown') this.scheduleNext()
    else { this.armTimer(); this.drive() }
  }
}
