import { Game, type Replay, type HistoryEntry, type Decision, type HandResult, type Meld, type ReactionOptions, type TurnAction, type TurnOptions } from './game'
import type { GameOptions } from './rules/types'
import type { RuleId } from './rules'
import { auditGame } from './audit'
import { autopilotReact, autopilotTurn, botReact, botSwap, botTurn, botVoid, explainDiscard } from './bot'
import { kindOf } from './tiles'

export interface Coach { kind: 'tsumo' | 'ron' | 'riichi' | 'discard' | 'call' | 'pass' | 'nuki' | 'kan'; tile?: number; n?: number; call?: string; threat?: boolean; /** the rule behind the advice */ why?: string; /** what the hand is heading for */ plan?: string; /** the discard leaves a tenpai hand that is furiten */ furi?: boolean }
export const CHAT_KEYS = ['hello', 'nice', 'thanks', 'hurry', 'oops', 'gg', 'e1', 'e2', 'e3', 'e4']
export interface RoomConfig extends GameOptions { rule: RuleId; /** chips move between signed-in players when the game ends (set by the host, enforced by the server) */ ranked?: boolean }
export const DEFAULT_CONFIG: RoomConfig = { rule: 'taiwan', aka: true, rounds: 1, minFan: 3, players: 4, botLevel: 'normal', coach: true }

export interface SeatSlot { id: string | null; name: string; connected: boolean; bot: boolean; afk?: number; dcAt?: number }
export interface PlayerView {
  seat: number; name: string; points: number; human: boolean; connected: boolean
  handCount: number; hand: number[] | null; drawn: number | null
  melds: Meld[]; discards: { tile: number; riichi: boolean; called: boolean }[]; flowers: number[]
  riichi: boolean; seatWind: number; nuki: number[]
  voidSuit: number | null; out: boolean; winOrder: number; swapIn: number[]
  /** 'slow' = a turn timed out and was played for them, 'auto' = a bot has taken over their seat for now */
  idle?: 'slow' | 'auto'
}
export interface TableView {
  status: 'lobby' | 'playing'
  config: RoomConfig
  seats: { name: string; human: boolean; connected: boolean; bot: boolean }[]
  you: number
  host: boolean
  game: null | {
    phase: string; turn: number; dealer: number; roundIndex: number; roundWind: number; honba: number; sticks: number; lian: number
    wallLeft: number; dora: number[]; handNo: number
    players: PlayerView[]
    lastDiscard: { tile: number; from: number } | null
    turnOptions: TurnOptions | null
    reaction: ReactionOptions | null
    pick: { swap: boolean[]; void: boolean[]; mine: number[] | null; dir: number }
    reactionKind: string
    waiting: number[]
    timeLeft?: number | null
    /** tiles from the riichi candidates whose discard would leave a tenpai hand that is furiten */
    riichiFuriten?: number[]
    /** ms until the next hand starts by itself while the result is open (null when not counting down) */
    ackLeft?: number | null
    result: HandResult | null
    acks: number[]
    standings: { seat: number; name: string; points: number }[]
    hint: { shanten: number; waits: number[]; discardWaits: Record<number, number[]>; left: Record<number, number>; values: Record<number, { total: number; label?: string; riichi?: boolean } | null>; furiten: boolean; why?: Record<number, { code: string; n?: number; need?: number; suit?: number }> } | null
    coach?: Coach | null
    history: HistoryEntry[]
    audit: { ok: boolean; checks: number; problems: string[] }
    notice: import('./game').WinNotice | null
    replays?: Replay[]
    chat: { n: number; seat: number; key: string; text?: string; ago: number }[]
    feed: { n: number; seat: number; key: string; text?: string }[]
    log: string[]
    rule: { id: RuleId; name: string; nSets: number }
  }
}


export class Table {
  config: RoomConfig
  slots: SeatSlot[] = []
  game: Game | null = null
  status: 'lobby' | 'playing' = 'lobby'
  /** identifies the current game for the match history; set when a game starts */
  matchId: string | null = null
  startedAt = 0
  hostId: string | null = null
  acks = new Set<number>()
  listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private ackTimer: ReturnType<typeof setTimeout> | null = null
  private ackDeadline: number | null = null
  speed = 1 // 0 = instant (tests)
  /** shuffle seats and pick a random first dealer at the start of every game (tests switch this off) */
  randomize = true
  /** Per-decision time limit in ms for human players (0 = off). Expired turns auto-play; two in a row hands the seat to a bot. */
  turnTimerMs = 0
  chatLog: { n: number; seat: number; key: string; text?: string; at: number }[] = []
  private chatN = 0
  private deadline: number | null = null
  private deadlineKey = ''
  private dTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: RoomConfig = DEFAULT_CONFIG) {
    this.config = config
    this.slots = [0, 1, 2, 3].map(() => ({ id: null, name: '', connected: false, bot: false }))
    this.fitSlots(); this.renameBots()
  }

  private get wantPlayers(): 3 | 4 { return (this.config.rule === 'riichi' || this.config.rule === 'hk') && this.config.players === 3 ? 3 : 4 }
  private fitSlots() {
    const n = this.wantPlayers
    while (this.slots.length < n) this.slots.push({ id: null, name: '', connected: false, bot: false })
    // move humans out of seats that are about to disappear
    for (let i = this.slots.length - 1; i >= n; i--) {
      const s = this.slots[i]
      if (s.id) { const free = this.slots.findIndex((x, j) => j < n && !x.id); if (free >= 0) { this.slots[free] = { ...s, bot: false } } }
      this.slots.pop()
    }
  }
  toggleBot(id: string, seat: number) {
    if (id !== this.hostId || this.status !== 'lobby' || !Number.isInteger(seat)) return
    const s = this.slots[seat]
    if (s && !s.id) { s.bot = !s.bot; this.emit() }
  }
  /** Everything needed to rebuild this room after a server restart. */
  serialize(): string {
    return JSON.stringify({
      v: 1, matchId: this.matchId, startedAt: this.startedAt, config: this.config, hostId: this.hostId, status: this.status, acks: [...this.acks], chatN: this.chatN,
      slots: this.slots.map((s) => ({ id: s.id, name: s.name, bot: s.bot, afk: s.afk ?? 0 })),
      game: this.game ? this.game.serialize() : null,
    })
  }
  /** Rebuild from `serialize()`. Everyone starts disconnected; a bot covers a seat after the grace period unless the player returns. */
  restore(json: string, resume = true) {
    const d = JSON.parse(json)
    if (!d || d.v !== 1) return
    this.config = d.config; this.hostId = d.hostId ?? null; this.status = d.status; this.matchId = d.matchId ?? null; this.startedAt = d.startedAt ?? 0; this.chatN = d.chatN ?? 0
    this.acks = new Set<number>(d.acks ?? [])
    this.slots = (d.slots as { id: string | null; name: string; bot: boolean; afk: number }[]).map((s) => ({ id: s.id, name: s.name, bot: s.bot, afk: s.afk, connected: false, dcAt: s.id ? Date.now() : undefined }))
    this.game = d.game ? Game.restore(d.game) : null
    if (resume) { this.emit(); this.drive() }
    if (this.hasPlayers()) this.closeIfEmpty() // after a restart nobody is connected yet: if nobody returns, the room is closed
  }
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  /** Seats nobody holds are always played by bots, named Bot 1, Bot 2, ... in seat order. */
  private renameBots() { let n = 0; for (const s of this.slots) { if (!s.id) { n++; s.name = `Bot ${n}` } } }
  /** problems found by the integrity audit after the latest move (empty = every rule check passed) */
  auditProblems: string[] = []
  auditRuns = 0
  private lastAuditKey = ''
  private runAudit() {
    const g = this.game
    if (!g || this.status !== 'playing') { this.auditProblems = []; return }
    const key = `${g.handNo}:${g.phase}:${g.turn}:${g.wall.length}:${g.players.reduce((a, p) => a + p.hand.length + p.melds.length * 7 + p.discards.length * 13, 0)}`
    if (key === this.lastAuditKey) return
    this.lastAuditKey = key
    this.auditRuns++
    this.auditProblems = auditGame(g)
    if (this.auditProblems.length) console.error('[audit] rule check failed:', this.auditProblems.join(' | '))
  }
  private emit() { this.renameBots(); this.runAudit(); this.listeners.forEach((f) => f()) }
  isHuman(seat: number) { return this.slots[seat].id !== null }
  /** A dropped player keeps their seat for `graceMs` (short network blips don't hand the game to a bot). */
  graceMs = 8000
  /** a human seat that nobody is playing right now (gone or idle): it only throws what it drew and passes */
  isAutopilot(seat: number) { return this.slots[seat].id !== null && this.isBotControlled(seat) }
  isBotControlled(seat: number) { const s = this.slots[seat]; return !s.id || (s.afk ?? 0) >= 2 || (!s.connected && Date.now() - (s.dcAt ?? 0) >= this.graceMs) }

  // ----- lobby -----
  join(id: string, name: string): number {
    if (typeof id !== 'string' || !id || id.length > 64) return -1
    name = typeof name === 'string' ? name.replace(/[\u0000-\u001f<>]/g, '').trim() : ''
    let seat = this.slots.findIndex((s) => s.id === id)
    if (seat < 0) seat = this.slots.findIndex((s) => s.id === null && (this.status === 'playing' || !s.bot)) // lobby: first open seat; mid-game: replace a bot
    if (seat < 0) return -1
    const s = this.slots[seat]
    s.id = id; s.name = name.slice(0, 16) || 'Player'; s.connected = true; s.afk = 0
    if (this.emptyTimer) { clearTimeout(this.emptyTimer); this.emptyTimer = null }
    if (this.game) this.game.players[seat].name = s.name
    if (!this.hostId || !this.slots.some((x) => x.id === this.hostId)) this.hostId = id
    this.emit(); this.drive()
    return seat
  }
  /** Does anyone hold a seat in this room? (A room nobody ever created, or everybody left, has no players.) */
  hasPlayers() { return this.slots.some((s) => s.id) }
  /** Decides whether a connection may enter: creating a room with a code that is already in use, or joining a code nobody created, is refused. */
  admit(id: string, create: boolean): 'ok' | 'code_taken' | 'room_not_found' {
    if (this.seatOf(id) >= 0) return 'ok' // coming back to your own seat (refresh, reconnect)
    if (create) return this.hasPlayers() ? 'code_taken' : 'ok'
    return this.hasPlayers() ? 'ok' : 'room_not_found'
  }
  /** How long a started game with nobody connected is kept before the room is closed. */
  emptyMs = 180000
  private emptyTimer: ReturnType<typeof setTimeout> | null = null
  private closeIfEmpty() {
    if (this.emptyTimer) { clearTimeout(this.emptyTimer); this.emptyTimer = null }
    if (this.slots.some((s) => s.id && s.connected)) return
    this.emptyTimer = setTimeout(() => {
      this.emptyTimer = null
      if (!this.slots.some((s) => s.id && s.connected)) this.reset()
    }, this.emptyMs)
  }
  /** Back to a brand-new empty room. */
  reset() {
    this.cancelTimers()
    this.game = null; this.status = 'lobby'; this.hostId = null; this.acks.clear()
    this.slots = [0, 1, 2, 3].map(() => ({ id: null, name: '', connected: false, bot: false }))
    this.fitSlots(); this.renameBots()
    this.emit()
  }
  /** `deliberate`: the player pressed Leave (a bot takes the seat at once instead of after the reconnect grace period). */
  leave(id: string, deliberate = false) {
    const seat = this.slots.findIndex((s) => s.id === id)
    if (seat < 0) return
    if (this.status === 'lobby') {
      this.slots[seat] = { id: null, name: '', connected: false, bot: false }
      if (this.hostId === id) this.hostId = this.slots.find((s) => s.id)?.id ?? null
    } else {
      this.slots[seat].connected = false
      this.slots[seat].dcAt = deliberate ? 0 : Date.now()
      // the host seat must not stay with someone who is gone: hand it to a player who is still here
      if (this.hostId === id) { const next = this.slots.find((s) => s.id && s.connected); if (next) this.hostId = next.id }
      this.closeIfEmpty()
      // when the grace period ends, a bot may need to take over this seat
      setTimeout(() => { if (this.game && !this.slots[seat].connected) { this.emit(); this.drive() } }, this.graceMs + 20)
    }
    this.emit(); this.drive()
  }
  seatOf(id: string) { return this.slots.findIndex((s) => s.id === id) }
  setConfig(id: string, c: Partial<RoomConfig>) {
    if (id !== this.hostId || this.status !== 'lobby' || !c || typeof c !== 'object') return
    // accept only known keys with valid values (clients send arbitrary JSON)
    const clean: Partial<RoomConfig> = {}
    if (c.rule === 'riichi' || c.rule === 'hk' || c.rule === 'taiwan' || c.rule === 'mcr' || c.rule === 'sichuan') clean.rule = c.rule
    if (typeof c.swap === 'boolean') clean.swap = c.swap
    if (c.rounds === 1 || c.rounds === 2 || c.rounds === 4) clean.rounds = c.rounds
    if (typeof c.aka === 'boolean') clean.aka = c.aka
    if (typeof c.coach === 'boolean') clean.coach = c.coach
    if (typeof c.ranked === 'boolean') clean.ranked = c.ranked
    if (Number.isInteger(c.minFan) && c.minFan! >= 0 && c.minFan! <= 13) clean.minFan = c.minFan
    if (c.players === 3 || c.players === 4) clean.players = c.players
    if (c.botLevel === 'easy' || c.botLevel === 'normal' || c.botLevel === 'hard') clean.botLevel = c.botLevel
    const next = { ...this.config, ...clean }
    if (clean.rule && clean.rule !== this.config.rule && clean.minFan === undefined) next.minFan = clean.rule === 'mcr' ? 8 : clean.rule === 'hk' ? 3 : next.minFan
    if (next.rule === 'taiwan' && next.rounds === 2) next.rounds = 4
    if (next.rule !== 'taiwan' && next.rounds === 4) next.rounds = 2
    if (next.rule !== 'riichi' && next.rule !== 'hk') next.players = 4
    if (next.players === 3 && this.slots.filter((x) => x.id).length > 3) return
    this.config = next
    this.fitSlots()
    this.emit()
  }
  start(id?: string) {
    if (id !== undefined && id !== this.hostId) return
    if (this.status !== 'lobby') return
    this.fitSlots()
    // random seats: players (and bots) are shuffled into seats at the start of every game, so nobody is always East
    if (this.randomize) for (let i = this.slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.slots[i], this.slots[j]] = [this.slots[j], this.slots[i]] }
    this.renameBots()
    this.game = new Game(this.config.rule, { ...this.config, fixedDealer: !this.randomize }, this.slots.map((s) => s.name))
    this.status = 'playing'
    this.matchId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    this.startedAt = Date.now()
    this.acks.clear()
    this.emit(); this.drive()
  }
  backToLobby(id: string) {
    if (id !== this.hostId) return
    this.cancelTimers()
    this.game = null; this.status = 'lobby'
    this.slots.forEach((s, i) => { if (!s.connected) this.slots[i] = { id: null, name: '', connected: false, bot: false } })
    this.emit()
  }

  // ----- play -----
  turnAction(id: string, a: TurnAction) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game) return
    if (this.game.act(seat, a)) { this.slots[seat].afk = 0; this.emit(); this.drive() }
  }
  swap(id: string, tiles: number[]) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game) return
    if (this.game.submitSwap(seat, tiles)) { this.slots[seat].afk = 0; this.emit(); this.drive() }
  }
  pickVoid(id: string, suit: number) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game) return
    if (this.game.submitVoid(seat, suit)) { this.slots[seat].afk = 0; this.emit(); this.drive() }
  }
  decide(id: string, d: Decision) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game) return
    if (this.game.submitDecision(seat, d)) { this.slots[seat].afk = 0; this.emit(); this.drive() }
  }
  /** "I'm here": clears the idle count so the seat is played by its human again */
  here(id: string) {
    const seat = this.seatOf(id)
    if (seat < 0 || !(this.slots[seat].afk ?? 0)) return
    this.slots[seat].afk = 0
    this.emit(); this.drive()
  }
  chat(id: string, key: string) {
    const seat = this.seatOf(id)
    if (seat < 0 || !CHAT_KEYS.includes(key)) return
    const last = [...this.chatLog].reverse().find((c) => c.seat === seat)
    if (last && Date.now() - last.at < 800) return
    this.chatLog.push({ n: ++this.chatN, seat, key, at: Date.now() })
    if (this.chatLog.length > 40) this.chatLog.shift()
    this.emit()
  }
  /** Free-text chat: trimmed, control characters removed, 80 characters max, rate limited. */
  say(id: string, raw: string) {
    const seat = this.seatOf(id)
    if (seat < 0 || typeof raw !== 'string') return
    const text = raw.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!text) return
    const now = Date.now()
    const mine = this.chatLog.filter((c) => c.seat === seat)
    if (mine.length && now - mine[mine.length - 1].at < 800) return
    if (mine.filter((c) => now - c.at < 10000).length >= 6) return
    this.chatLog.push({ n: ++this.chatN, seat, key: '', text, at: now })
    if (this.chatLog.length > 40) this.chatLog.shift()
    this.emit()
  }
  ack(id: string) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game || this.game.phase !== 'result') return
    this.acks.add(seat)
    this.emit(); this.drive()
  }

  private cancelTimers() {
    if (this.dTimer) clearTimeout(this.dTimer)
    this.dTimer = null; this.deadline = null; this.deadlineKey = ''
    if (this.timer) clearTimeout(this.timer)
    if (this.ackTimer) clearTimeout(this.ackTimer)
    this.timer = this.ackTimer = null
  }
  private later(fn: () => void, ms: number) {
    if (this.timer) clearTimeout(this.timer)
    if (this.speed === 0) { this.timer = null; fn(); return }
    this.timer = setTimeout(() => { this.timer = null; fn() }, ms * this.speed)
  }

  private armDeadline() {
    const g = this.game!
    let seats: number[] = []
    if (g.phase === 'turn' && !this.isBotControlled(g.turn)) seats = [g.turn]
    else if (g.phase === 'reaction') seats = g.pendingSeats().filter((s) => !this.isBotControlled(s))
    else if (g.phase === 'swap' || g.phase === 'void') seats = this.pickPending(g).filter((s) => !this.isBotControlled(s))
    if (!this.turnTimerMs || !seats.length) {
      if (this.dTimer) clearTimeout(this.dTimer)
      this.dTimer = null; this.deadline = null; this.deadlineKey = ''
      return
    }
    const key = [g.handNo, g.phase, g.turn, g.players.reduce((a, p) => a + p.discards.length + p.melds.length, 0), seats.join()].join(':')
    if (key === this.deadlineKey) return
    this.deadlineKey = key
    this.deadline = Date.now() + this.turnTimerMs
    if (this.dTimer) clearTimeout(this.dTimer)
    this.dTimer = setTimeout(() => this.onTimeout(key), this.turnTimerMs)
  }

  private pickPending(g: Game): number[] {
    if (g.phase === 'swap') return g.players.filter((p) => !p.swapTiles).map((p) => p.seat)
    if (g.phase === 'void') return g.players.filter((p) => p.voidSuit === null).map((p) => p.seat)
    return []
  }
  private botPick(g: Game, s: number) {
    if (g.phase === 'swap' && !g.players[s].swapTiles) g.submitSwap(s, botSwap(g, s))
    else if (g.phase === 'void' && g.players[s].voidSuit === null) g.submitVoid(s, botVoid(g, s))
  }

  private onTimeout(key: string) {
    const g = this.game
    if (!g || key !== this.deadlineKey) return
    if (g.phase === 'swap' || g.phase === 'void') {
      for (const s of this.pickPending(g)) if (!this.isBotControlled(s)) { this.slots[s].afk = (this.slots[s].afk ?? 0) + 1; this.botPick(g, s) }
      this.emit(); this.drive()
      return
    }
    if (g.phase === 'turn') {
      const s = g.turn
      const o = g.turnOptions(s)
      this.slots[s].afk = (this.slots[s].afk ?? 0) + 1
      g.act(s, o.tsumo ? { type: 'tsumo' } : { type: 'discard', tile: o.discard[o.discard.length - 1] })
    } else if (g.phase === 'reaction') {
      for (const s of g.pendingSeats()) if (!this.isBotControlled(s)) { this.slots[s].afk = (this.slots[s].afk ?? 0) + 1; g.submitDecision(s, { type: 'pass' }) }
    }
    this.emit(); this.drive()
  }

  /** Runs bots / auto-advances. Safe to call after any change. */
  drive() {
    const g = this.game
    if (!g || this.status !== 'playing') return
    // every drive starts from a clean slate: a timer scheduled for an older state must never fire against a newer one
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this.armDeadline()
    if (g.phase === 'turn') {
      const s = g.turn
      const p = g.players[s]
      if (this.isBotControlled(s)) {
        this.later(() => {
          if (this.game !== g || g.phase !== 'turn' || g.turn !== s || !this.isBotControlled(s)) return this.drive()
          const a = this.isAutopilot(s) ? autopilotTurn(g, s) : botTurn(g, s, this.config.botLevel)
          if (!g.act(s, a)) { const o = g.turnOptions(s); if (o.discard.length) g.act(s, { type: 'discard', tile: o.discard[o.discard.length - 1] }) }
          this.emit(); this.drive()
        }, 750)
      } else if (p.riichi) {
        const o = g.turnOptions(s)
        if (!o.tsumo && !o.ankan.length && o.discard.length) {
          this.later(() => {
            if (this.game !== g || g.phase !== 'turn' || g.turn !== s) return this.drive()
            const o2 = g.turnOptions(s)
            if (!o2.tsumo && !o2.ankan.length && o2.discard.length) g.act(s, { type: 'discard', tile: o2.discard[0] })
            this.emit(); this.drive()
          }, 700)
        }
      }
    } else if (g.phase === 'swap' || g.phase === 'void') {
      const phase = g.phase
      if (this.pickPending(g).some((s) => this.isBotControlled(s))) {
        this.later(() => {
          if (this.game !== g || g.phase !== phase) return this.drive()
          for (const s of this.pickPending(g).filter((x) => this.isBotControlled(x))) this.botPick(g, s)
          this.emit(); this.drive()
        }, 600)
      }
    } else if (g.phase === 'reaction') {
      if (g.pendingSeats().some((s) => this.isBotControlled(s))) {
        this.later(() => {
          if (this.game !== g || g.phase !== 'reaction') return this.drive()
          for (const s of g.pendingSeats().filter((x) => this.isBotControlled(x))) if (g.phase === 'reaction') g.submitDecision(s, this.isAutopilot(s) ? autopilotReact(g, s) : botReact(g, s, this.config.botLevel))
          this.emit(); this.drive()
        }, 450)
      }
    } else if (g.phase === 'result') {
      const humans = g.players.map((_, i) => i).filter((s) => !this.isBotControlled(s))
      if (humans.every((s) => this.acks.has(s))) {
        this.later(() => {
          if (this.game !== g || g.phase !== 'result') return
          g.next(); this.acks.clear(); this.emit(); this.drive()
        }, 300)
      } else if (!this.ackTimer && this.speed !== 0) {
        this.ackDeadline = Date.now() + 45000 * Math.max(this.speed, 0.001)
        this.ackTimer = setTimeout(() => { this.ackTimer = null; this.ackDeadline = null; if (this.game === g && g.phase === 'result') { g.next(); this.acks.clear(); this.emit(); this.drive() } }, 45000 * Math.max(this.speed, 0.001))
      }
    }
    if (g.phase !== 'result' && this.ackTimer) { clearTimeout(this.ackTimer); this.ackTimer = null; this.ackDeadline = null }
  }

  /** What the Hard bot would do in the viewer's seat, and why (for beginners). */
  private coachFor(g: Game, you: number): Coach | null {
    const p = g.players[you]
    if (!p || p.out || this.config.coach === false) return null
    try {
      const threat = g.players.some((q) => q.seat !== you && q.riichi)
      if (g.phase === 'turn' && g.turn === you) {
        const a = botTurn(g, you, 'hard')
        if (a.type === 'tsumo') return { kind: 'tsumo' }
        if (a.type === 'discard') {
          const rest = p.hand.filter((i) => i !== a.tile)
          const n = g.shanten(you, rest)
          const ex = explainDiscard(g, you, a.tile)
          return { kind: a.riichi ? 'riichi' : 'discard', tile: a.tile, n, threat, why: ex.why, plan: ex.plan, furi: n === 0 && g.furitenIfDiscard(you, a.tile) }
        }
        if (a.type === 'nuki') return { kind: 'nuki' }
        if (a.type === 'ankan') return { kind: 'kan', call: 'ankan', tile: p.hand.find((i) => kindOf(i) === a.kind) }
        if (a.type === 'kakan') return { kind: 'kan', call: 'kakan', tile: a.tile }
        return null
      }
      if (g.phase === 'reaction' && g.reactions[you] && !g.decisions[you]) {
        const d = botReact(g, you, 'hard')
        if (d.type === 'ron') return { kind: 'ron' }
        if (d.type === 'pass') return { kind: 'pass', n: g.shanten(you) }
        const lk = g.lastDiscard ? kindOf(g.lastDiscard.tile) : -1
        const sw = 27 + g.seatWind(you), rw = 27 + g.roundWind
        const why = d.type === 'chi' ? 'chi' : (lk >= 27 && (lk >= 31 || lk === sw || lk === rw)) ? 'yakuhaiPon' : d.type === 'pon' ? 'pon' : 'kan'
        return { kind: 'call', call: d.type, n: g.shanten(you), tile: g.lastDiscard?.tile, why }
      }
    } catch { /* the coach never breaks the game */ }
    return null
  }

  // ----- views -----
  view(id: string): TableView {
    const you = this.seatOf(id)
    const base: TableView = {
      status: this.status, config: this.config, you, host: id === this.hostId,
      seats: this.slots.map((s) => ({ name: s.name, human: s.id !== null, connected: s.connected, bot: s.bot })),
      game: null,
    }
    const g = this.game
    if (!g) return base
    const over = g.phase === 'result' || g.phase === 'over'
    const players: PlayerView[] = g.players.map((p) => ({
      seat: p.seat, name: p.name, points: p.points, human: this.slots[p.seat].id !== null,
      connected: this.slots[p.seat].connected,
      idle: this.slots[p.seat].id === null ? undefined : (this.slots[p.seat].afk ?? 0) >= 2 ? 'auto' : (this.slots[p.seat].afk ?? 0) === 1 ? 'slow' : undefined,
      handCount: p.hand.length - (p.drawn !== null ? 1 : 0), hand: p.seat === you || over || p.out ? p.hand.filter((i) => i !== p.drawn) : null,
      drawn: p.seat === you || over ? p.drawn : null,
      melds: p.melds, discards: p.discards, flowers: p.flowers, riichi: p.riichi, seatWind: g.seatWind(p.seat), nuki: p.nuki,
      voidSuit: g.phase === 'swap' || g.phase === 'void' ? (p.seat === you ? p.voidSuit : null) : p.voidSuit,
      out: p.out, winOrder: g.sc.wins.find((w) => w.winner === p.seat)?.order ?? 0, swapIn: p.seat === you ? p.swapIn : [],
    }))
    let hint: NonNullable<TableView['game']>['hint'] = null
    if (you >= 0 && this.config.coach !== false && (g.phase === 'turn' || g.phase === 'reaction')) {
      const me = g.players[you]
      const vis = g.visibleCounts(you)
      const leftOf = (ks: number[]) => Object.fromEntries(ks.map((k) => [k, Math.max(0, 4 - vis[k])]))
      if (me.drawn !== null && g.phase === 'turn' && g.turn === you) {
        const dw: Record<number, number[]> = {}
        for (const id2 of new Set(me.hand.map(kindOf))) {
          const idx = me.hand.findIndex((x) => kindOf(x) === id2)
          const rest = me.hand.slice(); rest.splice(idx, 1)
          const w = g.waitsFor(you, rest)
          if (w.length) dw[id2] = w
        }
        const all = [...new Set(Object.values(dw).flat())]
        hint = { shanten: g.shanten(you), waits: [], discardWaits: dw, left: leftOf(all), values: {}, furiten: false }
      } else if (me.hand.length % 3 === 1) {
        const w = g.waitsFor(you)
        const values: Record<number, { total: number; label?: string; riichi?: boolean } | null> = {}
        for (const k of w) {
          let sc = g.checkWin(you, false, k * 4 + 3)
          let viaRiichi = false
          if (!sc && g.isRiichi && !me.riichi && g.isClosed(me) && me.points >= 1000) {
            // no yaku yet: what would it be worth if riichi were declared?
            me.riichi = true
            try { sc = g.checkWin(you, false, k * 4 + 3) } finally { me.riichi = false }
            viaRiichi = !!sc
          }
          values[k] = sc ? { total: sc.total, label: sc.label, riichi: viaRiichi || undefined } : null
        }
        const why: Record<number, { code: string; n?: number; need?: number; suit?: number }> = {}
        for (const k of w) if (!values[k]) { const x = g.explainNoWin(you, false, k * 4 + 3); if (x) why[k] = { code: x.code, n: x.n, need: x.need, suit: x.suit } }
        hint = { shanten: g.shanten(you), waits: w, discardWaits: {}, left: leftOf(w), values, furiten: g.isFuriten(you), why }
      }
    }
    base.game = {
      phase: g.phase, turn: g.turn, dealer: g.dealer, roundIndex: g.roundIndex, roundWind: g.roundWind, honba: g.honba, sticks: g.sticks, lian: g.lian,
      wallLeft: g.wall.length, dora: g.doraIndicators(), handNo: g.handNo, players,
      lastDiscard: g.lastDiscard,
      turnOptions: you >= 0 && g.phase === 'turn' && g.turn === you ? g.turnOptions(you) : null,
      reaction: you >= 0 && g.phase === 'reaction' && g.reactions[you] && !g.decisions[you] ? g.reactions[you] : null,
      pick: { swap: g.players.map((p) => !!p.swapTiles), void: g.players.map((p) => p.voidSuit !== null), mine: you >= 0 ? g.players[you].swapTiles : null, dir: g.swapDir },
      reactionKind: g.reactionKind, waiting: g.phase === 'swap' || g.phase === 'void' ? this.pickPending(g) : g.pendingSeats(),
      timeLeft: this.deadline && you >= 0 && (g.phase === 'turn' ? g.turn === you : g.phase === 'swap' || g.phase === 'void' ? this.pickPending(g).includes(you) : g.pendingSeats().includes(you)) ? Math.max(0, this.deadline - Date.now()) : null,
      riichiFuriten: you >= 0 && g.phase === 'turn' && g.turn === you ? g.turnOptions(you).riichi.filter((tl) => g.furitenIfDiscard(you, tl)) : [],
      ackLeft: g.phase === 'result' && this.ackDeadline ? Math.max(0, this.ackDeadline - Date.now()) : null,
      result: g.result, acks: [...this.acks], standings: g.standings(), hint, log: g.log.slice(-8),
      history: g.history,
      notice: you >= 0 ? g.notices[you] ?? null : null,
      coach: you >= 0 ? this.coachFor(g, you) : null,
      audit: { ok: this.auditProblems.length === 0, checks: this.auditRuns, problems: this.auditProblems.slice(0, 3) },
      replays: g.phase === 'over' ? g.replays : undefined,
      chat: this.chatLog.filter((c) => Date.now() - c.at < 8000).map((c) => ({ n: c.n, seat: c.seat, key: c.key, text: c.text, ago: Date.now() - c.at })),
      feed: this.chatLog.slice(-8).map((c) => ({ n: c.n, seat: c.seat, key: c.key, text: c.text })),
      rule: { id: g.rule.id, name: g.rule.name, nSets: g.rule.nSets },
    }
    return base
  }
}
