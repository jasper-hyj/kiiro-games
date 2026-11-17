import { Game, type Decision, type HandResult, type Meld, type ReactionOptions, type TurnAction, type TurnOptions } from './game'
import type { GameOptions } from './rules/types'
import type { RuleId } from './rules'
import { botReact, botTurn } from './bot'
import { kindOf } from './tiles'

export interface RoomConfig extends GameOptions { rule: RuleId }
export const DEFAULT_CONFIG: RoomConfig = { rule: 'taiwan', aka: true, rounds: 1, minFan: 3 }

export interface SeatSlot { id: string | null; name: string; connected: boolean }
export interface PlayerView {
  seat: number; name: string; points: number; human: boolean; connected: boolean
  handCount: number; hand: number[] | null; drawn: number | null
  melds: Meld[]; discards: { tile: number; riichi: boolean; called: boolean }[]; flowers: number[]
  riichi: boolean; seatWind: number
}
export interface TableView {
  status: 'lobby' | 'playing'
  config: RoomConfig
  seats: { name: string; human: boolean; connected: boolean }[]
  you: number
  host: boolean
  game: null | {
    phase: string; turn: number; dealer: number; roundIndex: number; roundWind: number; honba: number; sticks: number; lian: number
    wallLeft: number; dora: number[]; handNo: number
    players: PlayerView[]
    lastDiscard: { tile: number; from: number } | null
    turnOptions: TurnOptions | null
    reaction: ReactionOptions | null
    reactionKind: string
    waiting: number[]
    result: HandResult | null
    acks: number[]
    standings: { seat: number; name: string; points: number }[]
    hint: { shanten: number; waits: number[]; discardWaits: Record<number, number[]> } | null
    log: string[]
    rule: { id: RuleId; name: string; nSets: number }
  }
}

const BOT_NAMES = ['Hana', 'Ryo', 'Mei', 'Kai', 'Yuki', 'Sora']

export class Table {
  config: RoomConfig
  slots: SeatSlot[] = []
  game: Game | null = null
  status: 'lobby' | 'playing' = 'lobby'
  hostId: string | null = null
  acks = new Set<number>()
  listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private ackTimer: ReturnType<typeof setTimeout> | null = null
  speed = 1 // 0 = instant (tests)

  constructor(config: RoomConfig = DEFAULT_CONFIG) {
    this.config = config
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5)
    this.slots = [0, 1, 2, 3].map((i) => ({ id: null, name: names[i], connected: false }))
  }

  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit() { this.listeners.forEach((f) => f()) }
  isHuman(seat: number) { return this.slots[seat].id !== null }
  isBotControlled(seat: number) { return !this.slots[seat].id || !this.slots[seat].connected }

  // ----- lobby -----
  join(id: string, name: string): number {
    let seat = this.slots.findIndex((s) => s.id === id)
    if (seat < 0 && this.status === 'lobby') seat = this.slots.findIndex((s) => s.id === null)
    if (seat < 0) return -1
    const s = this.slots[seat]
    s.id = id; s.name = name.slice(0, 16) || s.name; s.connected = true
    if (!this.hostId || !this.slots.some((x) => x.id === this.hostId)) this.hostId = id
    this.emit(); this.drive()
    return seat
  }
  leave(id: string) {
    const seat = this.slots.findIndex((s) => s.id === id)
    if (seat < 0) return
    if (this.status === 'lobby') {
      this.slots[seat] = { id: null, name: BOT_NAMES[seat], connected: false }
      if (this.hostId === id) this.hostId = this.slots.find((s) => s.id)?.id ?? null
    } else this.slots[seat].connected = false
    this.emit(); this.drive()
  }
  seatOf(id: string) { return this.slots.findIndex((s) => s.id === id) }
  setConfig(id: string, c: Partial<RoomConfig>) {
    if (id !== this.hostId || this.status !== 'lobby') return
    this.config = { ...this.config, ...c }
    this.emit()
  }
  start(id?: string) {
    if (id !== undefined && id !== this.hostId) return
    if (this.status !== 'lobby') return
    this.game = new Game(this.config.rule, this.config, this.slots.map((s) => s.name))
    this.status = 'playing'
    this.acks.clear()
    this.emit(); this.drive()
  }
  backToLobby(id: string) {
    if (id !== this.hostId) return
    this.cancelTimers()
    this.game = null; this.status = 'lobby'
    this.slots.forEach((s, i) => { if (!s.connected) this.slots[i] = { id: null, name: BOT_NAMES[i], connected: false } })
    this.emit()
  }

  // ----- play -----
  turnAction(id: string, a: TurnAction) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game) return
    if (this.game.act(seat, a)) { this.emit(); this.drive() }
  }
  decide(id: string, d: Decision) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game) return
    if (this.game.submitDecision(seat, d)) { this.emit(); this.drive() }
  }
  ack(id: string) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game || this.game.phase !== 'result') return
    this.acks.add(seat)
    this.emit(); this.drive()
  }

  private cancelTimers() {
    if (this.timer) clearTimeout(this.timer)
    if (this.ackTimer) clearTimeout(this.ackTimer)
    this.timer = this.ackTimer = null
  }
  private later(fn: () => void, ms: number) {
    if (this.timer) clearTimeout(this.timer)
    if (this.speed === 0) { this.timer = null; fn(); return }
    this.timer = setTimeout(() => { this.timer = null; fn() }, ms * this.speed)
  }

  /** Runs bots / auto-advances. Safe to call after any change. */
  drive() {
    const g = this.game
    if (!g || this.status !== 'playing') return
    if (g.phase === 'turn') {
      const s = g.turn
      const p = g.players[s]
      if (this.isBotControlled(s)) {
        this.later(() => { const a = botTurn(g, s); g.act(s, a); this.emit(); this.drive() }, 750)
      } else if (p.riichi) {
        const o = g.turnOptions(s)
        if (!o.tsumo && !o.ankan.length) this.later(() => { g.act(s, { type: 'discard', tile: o.discard[0] }); this.emit(); this.drive() }, 700)
      }
    } else if (g.phase === 'reaction') {
      const pend = g.pendingSeats().filter((s) => this.isBotControlled(s))
      if (pend.length) {
        this.later(() => {
          for (const s of pend) if (g.phase === 'reaction') g.submitDecision(s, botReact(g, s))
          this.emit(); this.drive()
        }, 450)
      }
    } else if (g.phase === 'result') {
      const humans = [0, 1, 2, 3].filter((s) => !this.isBotControlled(s))
      if (humans.every((s) => this.acks.has(s))) {
        this.later(() => { g.next(); this.acks.clear(); this.emit(); this.drive() }, 300)
      } else if (!this.ackTimer && this.speed !== 0) {
        this.ackTimer = setTimeout(() => { this.ackTimer = null; if (g.phase === 'result') { g.next(); this.acks.clear(); this.emit(); this.drive() } }, 45000)
      }
    }
    if (g.phase !== 'result' && this.ackTimer) { clearTimeout(this.ackTimer); this.ackTimer = null }
  }

  // ----- views -----
  view(id: string): TableView {
    const you = this.seatOf(id)
    const base: TableView = {
      status: this.status, config: this.config, you, host: id === this.hostId,
      seats: this.slots.map((s) => ({ name: s.name, human: s.id !== null, connected: s.connected })),
      game: null,
    }
    const g = this.game
    if (!g) return base
    const over = g.phase === 'result' || g.phase === 'over'
    const players: PlayerView[] = g.players.map((p) => ({
      seat: p.seat, name: p.name, points: p.points, human: this.slots[p.seat].id !== null,
      connected: this.slots[p.seat].connected,
      handCount: p.hand.length - (p.drawn !== null ? 1 : 0), hand: p.seat === you || over ? p.hand.filter((i) => i !== p.drawn) : null,
      drawn: p.seat === you || over ? p.drawn : null,
      melds: p.melds, discards: p.discards, flowers: p.flowers, riichi: p.riichi, seatWind: g.seatWind(p.seat),
    }))
    let hint: NonNullable<TableView['game']>['hint'] = null
    if (you >= 0 && (g.phase === 'turn' || g.phase === 'reaction')) {
      const me = g.players[you]
      if (me.drawn !== null && g.phase === 'turn' && g.turn === you) {
        const dw: Record<number, number[]> = {}
        for (const id2 of new Set(me.hand.map(kindOf))) {
          const idx = me.hand.findIndex((x) => kindOf(x) === id2)
          const rest = me.hand.slice(); rest.splice(idx, 1)
          const w = g.waitsFor(you, rest)
          if (w.length) dw[id2] = w
        }
        hint = { shanten: g.shanten(you), waits: [], discardWaits: dw }
      } else if (me.hand.length % 3 === 1) {
        hint = { shanten: g.shanten(you), waits: g.waitsFor(you), discardWaits: {} }
      }
    }
    base.game = {
      phase: g.phase, turn: g.turn, dealer: g.dealer, roundIndex: g.roundIndex, roundWind: g.roundWind, honba: g.honba, sticks: g.sticks, lian: g.lian,
      wallLeft: g.wall.length, dora: g.doraIndicators(), handNo: g.handNo, players,
      lastDiscard: g.lastDiscard,
      turnOptions: you >= 0 && g.phase === 'turn' && g.turn === you ? g.turnOptions(you) : null,
      reaction: you >= 0 && g.phase === 'reaction' && g.reactions[you] && !g.decisions[you] ? g.reactions[you] : null,
      reactionKind: g.reactionKind, waiting: g.pendingSeats(),
      result: g.result, acks: [...this.acks], standings: g.standings(), hint, log: g.log.slice(-8),
      rule: { id: g.rule.id, name: g.rule.name, nSets: g.rule.nSets },
    }
    return base
  }
}
