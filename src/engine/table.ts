import { Game, type HistoryEntry, type Decision, type HandResult, type Meld, type ReactionOptions, type TurnAction, type TurnOptions } from './game'
import type { GameOptions } from './rules/types'
import type { RuleId } from './rules'
import { botReact, botTurn } from './bot'
import { kindOf } from './tiles'

export const CHAT_KEYS = ['hello', 'nice', 'thanks', 'hurry', 'oops', 'gg', 'e1', 'e2', 'e3', 'e4']
export interface RoomConfig extends GameOptions { rule: RuleId }
export const DEFAULT_CONFIG: RoomConfig = { rule: 'taiwan', aka: true, rounds: 1, minFan: 3, players: 4, botLevel: 'normal' }

export interface SeatSlot { id: string | null; name: string; connected: boolean; bot: boolean; afk?: number; dcAt?: number }
export interface PlayerView {
  seat: number; name: string; points: number; human: boolean; connected: boolean
  handCount: number; hand: number[] | null; drawn: number | null
  melds: Meld[]; discards: { tile: number; riichi: boolean; called: boolean }[]; flowers: number[]
  riichi: boolean; seatWind: number; nuki: number[]
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
    reactionKind: string
    waiting: number[]
    timeLeft?: number | null
    result: HandResult | null
    acks: number[]
    standings: { seat: number; name: string; points: number }[]
    hint: { shanten: number; waits: number[]; discardWaits: Record<number, number[]>; left: Record<number, number>; values: Record<number, { total: number; label?: string; riichi?: boolean } | null>; furiten: boolean } | null
    history: HistoryEntry[]
    chat: { n: number; seat: number; key: string; ago: number }[]
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
  /** Per-decision time limit in ms for human players (0 = off). Expired turns auto-play; two in a row hands the seat to a bot. */
  turnTimerMs = 0
  chatLog: { n: number; seat: number; key: string; at: number }[] = []
  private chatN = 0
  private deadline: number | null = null
  private deadlineKey = ''
  private dTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: RoomConfig = DEFAULT_CONFIG) {
    this.config = config
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5)
    this.slots = [0, 1, 2, 3].map((i) => ({ id: null, name: names[i], connected: false, bot: false }))
    this.fitSlots()
  }

  private get wantPlayers(): 3 | 4 { return this.config.rule === 'riichi' && this.config.players === 3 ? 3 : 4 }
  private fitSlots() {
    const n = this.wantPlayers
    while (this.slots.length < n) this.slots.push({ id: null, name: BOT_NAMES[this.slots.length], connected: false, bot: false })
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
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit() { this.listeners.forEach((f) => f()) }
  isHuman(seat: number) { return this.slots[seat].id !== null }
  /** A dropped player keeps their seat for `graceMs` (short network blips don't hand the game to a bot). */
  graceMs = 8000
  isBotControlled(seat: number) { const s = this.slots[seat]; return !s.id || (s.afk ?? 0) >= 2 || (!s.connected && Date.now() - (s.dcAt ?? 0) >= this.graceMs) }

  // ----- lobby -----
  join(id: string, name: string): number {
    if (typeof id !== 'string' || !id || id.length > 64) return -1
    name = typeof name === 'string' ? name.replace(/[\u0000-\u001f<>]/g, '').trim() : ''
    let seat = this.slots.findIndex((s) => s.id === id)
    if (seat < 0) seat = this.slots.findIndex((s) => s.id === null && (this.status === 'playing' || !s.bot)) // lobby: first open seat; mid-game: replace a bot
    if (seat < 0) return -1
    const s = this.slots[seat]
    s.id = id; s.name = name.slice(0, 16) || s.name; s.connected = true; s.afk = 0
    if (this.game) this.game.players[seat].name = s.name
    if (!this.hostId || !this.slots.some((x) => x.id === this.hostId)) this.hostId = id
    this.emit(); this.drive()
    return seat
  }
  leave(id: string) {
    const seat = this.slots.findIndex((s) => s.id === id)
    if (seat < 0) return
    if (this.status === 'lobby') {
      this.slots[seat] = { id: null, name: BOT_NAMES[seat], connected: false, bot: false }
      if (this.hostId === id) this.hostId = this.slots.find((s) => s.id)?.id ?? null
    } else {
      this.slots[seat].connected = false
      this.slots[seat].dcAt = Date.now()
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
    if (c.rule === 'riichi' || c.rule === 'hk' || c.rule === 'taiwan') clean.rule = c.rule
    if (c.rounds === 1 || c.rounds === 2 || c.rounds === 4) clean.rounds = c.rounds
    if (typeof c.aka === 'boolean') clean.aka = c.aka
    if (Number.isInteger(c.minFan) && c.minFan! >= 0 && c.minFan! <= 13) clean.minFan = c.minFan
    if (c.players === 3 || c.players === 4) clean.players = c.players
    if (c.botLevel === 'easy' || c.botLevel === 'normal') clean.botLevel = c.botLevel
    const next = { ...this.config, ...clean }
    if (next.rule === 'taiwan' && next.rounds === 2) next.rounds = 4
    if (next.rule !== 'taiwan' && next.rounds === 4) next.rounds = 2
    if (next.rule !== 'riichi') next.players = 4
    if (next.players === 3 && this.slots.filter((x) => x.id).length > 3) return
    this.config = next
    this.fitSlots()
    this.emit()
  }
  start(id?: string) {
    if (id !== undefined && id !== this.hostId) return
    if (this.status !== 'lobby') return
    this.fitSlots()
    this.game = new Game(this.config.rule, this.config, this.slots.map((s) => s.name))
    this.status = 'playing'
    this.acks.clear()
    this.emit(); this.drive()
  }
  backToLobby(id: string) {
    if (id !== this.hostId) return
    this.cancelTimers()
    this.game = null; this.status = 'lobby'
    this.slots.forEach((s, i) => { if (!s.connected) this.slots[i] = { id: null, name: BOT_NAMES[i], connected: false, bot: false } })
    this.emit()
  }

  // ----- play -----
  turnAction(id: string, a: TurnAction) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game) return
    if (this.game.act(seat, a)) { this.slots[seat].afk = 0; this.emit(); this.drive() }
  }
  decide(id: string, d: Decision) {
    const seat = this.seatOf(id)
    if (seat < 0 || !this.game) return
    if (this.game.submitDecision(seat, d)) { this.slots[seat].afk = 0; this.emit(); this.drive() }
  }
  chat(id: string, key: string) {
    const seat = this.seatOf(id)
    if (seat < 0 || !CHAT_KEYS.includes(key)) return
    const last = [...this.chatLog].reverse().find((c) => c.seat === seat)
    if (last && Date.now() - last.at < 800) return
    this.chatLog.push({ n: ++this.chatN, seat, key, at: Date.now() })
    if (this.chatLog.length > 12) this.chatLog.shift()
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

  private onTimeout(key: string) {
    const g = this.game
    if (!g || key !== this.deadlineKey) return
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
          const a = botTurn(g, s, this.config.botLevel)
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
    } else if (g.phase === 'reaction') {
      if (g.pendingSeats().some((s) => this.isBotControlled(s))) {
        this.later(() => {
          if (this.game !== g || g.phase !== 'reaction') return this.drive()
          for (const s of g.pendingSeats().filter((x) => this.isBotControlled(x))) if (g.phase === 'reaction') g.submitDecision(s, botReact(g, s, this.config.botLevel))
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
        this.ackTimer = setTimeout(() => { this.ackTimer = null; if (this.game === g && g.phase === 'result') { g.next(); this.acks.clear(); this.emit(); this.drive() } }, 45000 * Math.max(this.speed, 0.001))
      }
    }
    if (g.phase !== 'result' && this.ackTimer) { clearTimeout(this.ackTimer); this.ackTimer = null }
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
      handCount: p.hand.length - (p.drawn !== null ? 1 : 0), hand: p.seat === you || over ? p.hand.filter((i) => i !== p.drawn) : null,
      drawn: p.seat === you || over ? p.drawn : null,
      melds: p.melds, discards: p.discards, flowers: p.flowers, riichi: p.riichi, seatWind: g.seatWind(p.seat), nuki: p.nuki,
    }))
    let hint: NonNullable<TableView['game']>['hint'] = null
    if (you >= 0 && (g.phase === 'turn' || g.phase === 'reaction')) {
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
        hint = { shanten: g.shanten(you), waits: w, discardWaits: {}, left: leftOf(w), values, furiten: g.isFuriten(you) }
      }
    }
    base.game = {
      phase: g.phase, turn: g.turn, dealer: g.dealer, roundIndex: g.roundIndex, roundWind: g.roundWind, honba: g.honba, sticks: g.sticks, lian: g.lian,
      wallLeft: g.wall.length, dora: g.doraIndicators(), handNo: g.handNo, players,
      lastDiscard: g.lastDiscard,
      turnOptions: you >= 0 && g.phase === 'turn' && g.turn === you ? g.turnOptions(you) : null,
      reaction: you >= 0 && g.phase === 'reaction' && g.reactions[you] && !g.decisions[you] ? g.reactions[you] : null,
      reactionKind: g.reactionKind, waiting: g.pendingSeats(),
      timeLeft: this.deadline && you >= 0 && (g.phase === 'turn' ? g.turn === you : g.pendingSeats().includes(you)) ? Math.max(0, this.deadline - Date.now()) : null,
      result: g.result, acks: [...this.acks], standings: g.standings(), hint, log: g.log.slice(-8),
      history: g.history,
      chat: this.chatLog.filter((c) => Date.now() - c.at < 8000).map((c) => ({ n: c.n, seat: c.seat, key: c.key, ago: Date.now() - c.at })),
      rule: { id: g.rule.id, name: g.rule.name, nSets: g.rule.nSets },
    }
    return base
  }
}
