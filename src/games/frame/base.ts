/**
 * The shared frame of every turn-based game after Mahjong, Hold'em, Blackjack and Big Two: seats with bots, a host, a lobby, spectators,
 * turn timers, reconnect grace, a rematch, and a result for the leaderboard. A game only describes its own rules (see gomoku.ts for a small one):
 *   begin()          set up a new game (all seats are filled by then)
 *   turn()           which seat must act now (-1: nobody, or everybody is waiting)
 *   act(seat, m)     a human's move; return an error code, or null when it was accepted
 *   bot(seat)        make one move for a seat played by the computer
 *   gameView(seat)   what that seat may see (-1 = a spectator)
 *   outcome()        when finished: a score per seat (higher is better); chips are settled from these by the server
 *   saveState / loadState   the game's own state, for restarts
 */
export type Status = 'lobby' | 'playing' | 'over'
export type Cfg = Record<string, any>
export interface Seat {
  id: string | null
  name: string
  bot: boolean
  connected: boolean
  dcAt: number
  missed: number
}
export interface ConfigField {
  key: string
  label: string
  options: [string | number | boolean, string][]
}
export interface GameMeta {
  kind: string
  minPlayers: number
  maxPlayers: number
  /** chips per point of difference between a seat's score and the table average, in competitive games */
  chipUnit: number
  fields: ConfigField[]
  defaults: Cfg
  /** the number of seats comes from config.players (variable-size games) */
  variable: boolean
}
export interface Outcome {
  points: number[]
  /** the scores to show, in the game's own terms, when they differ from `points` (which settle chips and must balance) */
  scores?: number[]
  /** every winning seat, when more than one wins (partners, farmers, a tie for first) */
  winners?: number[]
  winner: number
  summary?: unknown
}
export interface PlayView {
  kind: string
  config: Cfg
  status: Status
  you: number
  host: boolean
  game: number
  seats: { seat: number; name: string; bot: boolean; connected: boolean; empty: boolean; me: boolean }[]
  turn: number
  timeLeft: number | null
  /** who makes the move for the seat on turn (the same seat, except when a partner plays for it) */
  actor: number
  /** this seat may act now although it is not "the" seat on turn (everyone moves at once) */
  anyTurn: boolean
  state: any
  result: Outcome | null
}

const clean = (s: unknown, n = 16) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, n)
export const BOT_NAME = (i: number) => `Bot ${i}`

export abstract class TurnGame {
  abstract readonly meta: GameMeta
  config: Cfg = {}
  seats: Seat[] = []
  status: Status = 'lobby'
  hostId: string | null = null
  gameNo = 0
  matchId: string | null = null
  startedAt = 0
  result: Outcome | null = null
  listeners = new Set<() => void>()
  /** a human's turn limit in ms (0 = off), the pause before a bot moves, and how long a dropped player keeps the seat */
  turnTimerMs = 60000
  botDelayMs = 800
  graceMs = 25000
  onOver: ((g: TurnGame) => void) | null = null
  private deadline: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  // ---- what a game provides ----
  protected abstract begin(): void
  abstract turn(): number
  protected abstract act(seat: number, m: any): string | null
  protected abstract bot(seat: number): void
  protected abstract gameView(seat: number): any
  protected abstract outcome(): Outcome | null
  protected abstract saveState(): any
  protected abstract loadState(s: any): void
  /** the seat that makes the moves for `turnSeat` (normally itself; in Bridge the declarer plays the dummy's cards) */
  protected controller(turnSeat: number): number {
    return turnSeat
  }
  /** a game may adjust a settings object after it was validated (e.g. rules that depend on each other) */
  protected tweak(c: Cfg): Cfg {
    return c
  }

  init() {
    this.config = { ...this.meta.defaults }
    this.resize()
    return this
  }

  // ---- seats ----
  get size() {
    return this.meta.variable
      ? Math.min(this.meta.maxPlayers, Math.max(this.meta.minPlayers, Number(this.config.players) || this.meta.maxPlayers))
      : this.meta.maxPlayers
  }
  private emptySeat(): Seat {
    return { id: null, name: '', bot: false, connected: false, dcAt: 0, missed: 0 }
  }
  private resize() {
    const n = this.size
    while (this.seats.length < n) this.seats.push(this.emptySeat())
    if (this.seats.length > n) this.seats.length = n
  }
  hasPlayers() {
    return this.seats.some((s) => s.id)
  }
  seatOf(id: string) {
    return this.seats.findIndex((s) => s.id === id)
  }
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
    s.id = id
    s.name = clean(name) || 'Player'
    s.connected = true
    s.dcAt = 0
    s.bot = false
    s.missed = 0
    if (!this.hostId || this.seatOf(this.hostId) < 0) this.hostId = id
    this.emit()
    this.drive()
    return i
  }
  /** a dropped connection keeps the seat for `graceMs`; a deliberate leave frees it (a bot plays on) */
  leave(id: string, deliberate = false) {
    const i = this.seatOf(id)
    if (i < 0) return
    const s = this.seats[i]
    if (this.status === 'playing') {
      s.connected = false
      s.dcAt = deliberate ? 0 : Date.now()
      if (deliberate) s.id = null
      this.emit()
      setTimeout(() => {
        this.emit()
        this.drive()
      }, this.graceMs + 20)
    } else {
      this.seats[i] = this.emptySeat()
    }
    if (this.hostId === id) this.hostId = this.seats.find((x) => x.id && x.connected)?.id ?? this.seats.find((x) => x.id)?.id ?? null
    this.emit()
    this.drive()
  }
  private botControlled(i: number) {
    const s = this.seats[i]
    return !!s && (s.bot || s.missed >= 2 || !s.id || (!s.connected && Date.now() - s.dcAt >= this.graceMs))
  }

  // ---- settings ----
  sanitize(raw: unknown): Cfg {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Cfg
    const out: Cfg = { ...this.meta.defaults }
    for (const f of this.meta.fields) {
      const hit = f.options.find(([v]) => v === r[f.key])
      if (hit) out[f.key] = hit[0]
    }
    if (typeof r.ranked === 'boolean') out.ranked = r.ranked
    return this.tweak(out)
  }
  setConfig(id: string, raw: unknown) {
    if (id !== this.hostId || this.status !== 'lobby') return
    this.config = this.sanitize(raw)
    this.resize()
    // humans beyond the new size cannot keep a seat there: move them up
    const humans = this.seats.filter((s) => s.id)
    if (humans.length > this.size) return
    this.emit()
  }

  // ---- messages ----
  message(id: string, m: any): string | null {
    if (!m || typeof m !== 'object') return null
    const seat = this.seatOf(id)
    switch (m.k) {
      case 'start':
        return this.start(id)
      case 'config':
        this.setConfig(id, m.config)
        return null
      case 'lobby':
        if (id === this.hostId && this.status === 'over') this.backToLobby()
        return null
      case 'sit': {
        if (seat >= 0) return null
        if (this.join(id, 'Player') < 0) return 'room_full'
        return null
      }
      case 'act': {
        if (this.status !== 'playing' || seat < 0) return 'not_playing'
        if (this.controller(this.turn()) !== seat && !this.simultaneous()) return 'not_your_turn'
        const err = this.act(seat, m.a)
        if (!err) {
          this.seats[seat].missed = 0
          this.afterAct()
        }
        return err
      }
    }
    return null
  }
  /** games where everyone acts at once (rare) return true; turn() is then ignored for permission */
  protected simultaneous() {
    return false
  }
  /** in a simultaneous step: does this seat still have something to do? */
  protected mayAct(_seat: number): boolean {
    return false
  }

  start(id: string): string | null {
    if (this.status === 'playing' || id !== this.hostId) return null
    if (this.status === 'over') this.backToLobby()
    const humans = this.seats.filter((s) => s.id).length
    if (humans < 1) return null
    let b = 0
    this.seats.forEach((s, i) => {
      if (!s.id) {
        s.bot = true
        s.connected = true
        s.name = BOT_NAME(++b)
        s.missed = 0
      }
      void i
    })
    this.status = 'playing'
    this.gameNo++
    this.result = null
    this.matchId = `${this.meta.kind}-${Date.now().toString(36)}-${this.gameNo}`
    this.startedAt = Date.now()
    this.begin()
    this.emit()
    this.drive()
    return null
  }
  backToLobby() {
    this.clearTimer()
    this.status = 'lobby'
    this.result = null
    this.seats = this.seats.map((s) => (s.bot || !s.id ? this.emptySeat() : { ...s, missed: 0 }))
    this.resize()
    this.emit()
  }

  /** make the computer's move for a seat now (a turn that timed out, a hint, or a test playing a whole game) */
  assist(seat: number) {
    if (this.status === 'playing' && this.turn() === seat) {
      this.bot(seat)
      this.afterAct()
    }
  }

  // ---- driving ----
  private afterAct() {
    const out = this.outcome()
    if (out && this.status === 'playing') {
      this.status = 'over'
      this.result = out
      this.clearTimer()
      this.emit()
      this.onOver?.(this)
      return
    }
    this.emit()
    this.drive()
  }
  drive() {
    this.clearTimer()
    if (this.status !== 'playing') return
    const i = this.turn()
    if (i < 0) return
    const ctrl = this.controller(i)
    if (this.botControlled(ctrl)) {
      const tick = () => {
        if (this.status === 'playing' && this.turn() === i) {
          this.bot(i)
          this.afterAct()
        }
      }
      if (this.botDelayMs === 0) tick()
      else this.timer = setTimeout(tick, this.botDelayMs)
      return
    }
    if (this.turnTimerMs > 0) {
      this.deadline = Date.now() + this.turnTimerMs
      this.timer = setTimeout(() => {
        if (this.status === 'playing' && this.turn() === i) {
          this.seats[ctrl].missed++
          this.bot(i)
          this.afterAct()
        }
      }, this.turnTimerMs)
    }
  }
  private clearTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.deadline = null
  }

  // ---- views ----
  view(id: string): PlayView {
    const you = this.seatOf(id)
    return {
      kind: this.meta.kind,
      config: this.config,
      status: this.status,
      you,
      host: this.hostId === id,
      game: this.gameNo,
      seats: this.seats.map((s, i) => ({ seat: i, name: s.name, bot: s.bot, connected: s.connected, empty: !s.id && !s.bot, me: i === you })),
      turn: this.status === 'playing' ? this.turn() : -1,
      anyTurn: this.status === 'playing' && you >= 0 && this.simultaneous() && this.mayAct(you),
      actor: this.status === 'playing' && this.turn() >= 0 ? this.controller(this.turn()) : -1,
      timeLeft: this.deadline && this.status === 'playing' && !this.seats[this.controller(this.turn())]?.bot ? Math.max(0, this.deadline - Date.now()) : null,
      // a copy, so a view never shares arrays with the live game (matters in practice mode, where the engine runs in the page)
      state: this.status === 'lobby' ? null : JSON.parse(JSON.stringify(this.gameView(you))),
      result: this.result ? JSON.parse(JSON.stringify(this.result)) : null,
    }
  }
  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  protected emit() {
    for (const f of this.listeners) f()
  }

  // ---- persistence ----
  serialize(): string {
    return JSON.stringify({
      v: 1,
      config: this.config,
      hostId: this.hostId,
      status: this.status,
      gameNo: this.gameNo,
      matchId: this.matchId,
      startedAt: this.startedAt,
      result: this.result,
      seats: this.seats,
      state: this.status === 'lobby' ? null : this.saveState(),
    })
  }
  restore(raw: string) {
    const d = JSON.parse(raw)
    this.config = d.config
    this.hostId = d.hostId
    this.status = d.status
    this.gameNo = d.gameNo
    this.matchId = d.matchId
    this.startedAt = d.startedAt
    this.result = d.result
    this.seats = (d.seats as Seat[]).map((s) => ({ ...s, connected: s.bot, dcAt: s.id ? Date.now() : 0 }))
    if (d.state) this.loadState(d.state)
    this.drive()
  }
  dispose() {
    this.clearTimer()
    this.listeners.clear()
  }
}
