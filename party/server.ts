import { routePartykitRequest, Server, type Connection, type WSMessage } from 'partyserver'
import { Table } from '../src/games/mahjong/engine/table'
import type { ClientMsg, ServerMsg } from '../src/games/mahjong/net/protocol'
import type { Env } from './d1'
import { handleApi } from './api'
import { userFromToken } from './auth'
import { recordMatch, trimReplays } from './matches'
import { hold, release } from './economy'
import { PokerTable, DEFAULT_POKER, BLINDS } from '../src/games/holdem/engine/table'
import { makeBlackjack } from '../src/games/blackjack/engine/table'
import { BigTwoTable } from '../src/games/bigtwo/engine/table'
import type { BtMsg } from '../src/games/bigtwo/net/protocol'
import type { CashGame, HandRecord } from '../src/games/shared/cash'
import type { PokerMsg, PokerServerMsg } from '../src/games/holdem/net/protocol'

export { Room } from './room'
export { Play } from './play'
export type Kind = 'mahjong' | 'holdem' | 'blackjack' | 'bigtwo'
const CASH_KINDS: Kind[] = ['holdem', 'blackjack']
/** most a player may take home from the house per day at Blackjack: keeps the leaderboard from being farmed against the dealer */
const BLACKJACK_DAILY_CAP = 20000

/** One Durable Object (room) == one table. The server owns the game; clients only ever see their own view. */
export class Main extends Server<Env> {
  table = new Table()
  /** signed-in players in this room: client id -> account (guests are simply absent) */
  accounts = new Map<string, { userId: string; name: string }>()
  private recorded: string | null = null
  /** which game this room is: decided by whoever creates the room code, then fixed */
  kind: Kind | null = null
  /** the chip-table game of this room (Hold'em, Blackjack) */
  game: CashGame | null = null
  /** Big Two room (a four-player card game with bots, settled like ranked Mahjong) */
  bt: BigTwoTable | null = null
  private btRecorded: string | null = null
  private isCash() { return this.kind !== null && CASH_KINDS.includes(this.kind) }
  /** cash-table sessions: client id -> ledger account and the reference that ties the buy-in to the cash-out */
  psess = new Map<string, { userId: string; ref: string; n: number }>()
  /** recent table chat for the card games (kept in memory only) */
  private talkLog: { n: number; name: string; text: string }[] = []
  private talkN = 0
  private lastTalk = new Map<string, number>()
  /** people who are in the room watching, without a seat (Big Two, Mahjong): they see only what the table shows publicly and can read and write chat */
  private watchers = new Set<string>()
  private watching() { const ids = new Set<string>(); for (const c of this.getConnections<{ id?: string }>()) { const id = c.state?.id; if (id && this.watchers.has(id)) ids.add(id) } return ids.size }
  private tableId = Math.random().toString(36).slice(2, 10)

  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private store: { get<T>(k: string): Promise<T | undefined>; put(k: string, v: unknown): Promise<void>; delete(k: string): Promise<unknown> }
  private envv: Env
  constructor(ctx: ConstructorParameters<typeof Server>[0], env: Env) { super(ctx, env); this.envv = env; this.store = (ctx as unknown as { storage: Main['store'] }).storage }

  /**
   * A table prepared by its room: the room's host pressed Start, the room asked this table (over the internal route below) to
   * expect that game with those rules and that host. Whoever joins first creates it; nobody needs to carry settings in a URL.
   */
  private pending: { game: Kind; cfg: Record<string, unknown>; host: string; until: number; applied: boolean } | null = null
  private livePending() { if (this.pending && this.pending.until < Date.now()) { this.pending = null; void this.store.delete('pending') } return this.pending }
  private occupied(): boolean { return this.kind === 'bigtwo' ? !!this.bt?.hasPlayers() : this.isCash() ? !!this.game?.hasPlayers() : this.table.slots.some((s) => s.id) }

  /** Plain HTTP to a table. `status` is public (is this code taken by a game?); `__prepare` is only reachable from a room (the Worker entry refuses it from outside). */
  async onRequest(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path.endsWith('/status')) return Response.json({ kind: this.kind, taken: this.kind !== null && this.occupied() })
    if (request.method === 'POST' && path.endsWith('/__prepare')) {
      const b = (await request.json().catch(() => ({}))) as { game?: string; cfg?: Record<string, unknown>; host?: string }
      const game = (['mahjong', 'holdem', 'blackjack', 'bigtwo'] as Kind[]).find((g) => g === b.game)
      if (!game || typeof b.host !== 'string') return Response.json({ error: 'bad_request' }, { status: 400 })
      if (this.kind && this.occupied()) return Response.json(this.kind === game ? { ok: true, existing: true } : { error: 'code_taken', kind: this.kind }, { status: this.kind === game ? 200 : 409 })
      // an old table nobody is in any more: start from scratch
      if (this.kind) { this.kind = null; this.game = null; this.bt = null; void this.store.delete('kind'); void this.store.delete('cash'); void this.store.delete('bt') }
      this.pending = { game, cfg: b.cfg && typeof b.cfg === 'object' ? b.cfg : {}, host: b.host, until: Date.now() + 15 * 60e3, applied: false }
      void this.store.put('pending', this.pending)
      return Response.json({ ok: true })
    }
    return new Response('Not found', { status: 404 })
  }

  async onStart() {
    this.table.turnTimerMs = 30000
    // a restart or redeploy evicts this object from memory: bring the room back from storage
    try {
      this.kind = (await this.store.get<Kind>('kind')) ?? null
      const saved = await this.store.get<string>('table')
      if (saved && !this.kind) this.kind = 'mahjong' // rooms saved before Hold'em existed
      if (this.isCash()) {
        const ps = await this.store.get<string>('cash')
        if (ps) { this.startCash(this.kind!, JSON.parse(ps).config); this.game!.restore(ps) }
        const ss = await this.store.get<[string, { userId: string; ref: string; n: number }][]>('psess')
        if (ss) this.psess = new Map(ss)
        this.tableId = (await this.store.get<string>('tableId')) ?? this.tableId
        if (this.game && this.game.hasPlayers()) this.scheduleSweep()
      } else if (this.kind === 'bigtwo') {
        const bs = await this.store.get<string>('bt')
        if (bs) { this.startBigTwo(); this.bt!.restore(bs) }
        this.btRecorded = (await this.store.get<string>('btRecorded')) ?? null
      } else if (saved) this.table.restore(saved)
      this.pending = (await this.store.get<Main['pending']>('pending')) ?? null
      const acc = await this.store.get<[string, { userId: string; name: string }][]>('accounts')
      if (acc) this.accounts = new Map(acc)
      this.recorded = (await this.store.get<string>('recorded')) ?? null
    } catch (e) { console.error('restore failed', e) }
    this.table.onChange(() => { if (!this.isCash() && this.kind !== 'bigtwo') { this.broadcastViews(); this.persistSoon(); void this.recordIfOver() } })
  }

  private persistSoon() {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      if (this.kind === 'bigtwo' && this.bt) {
        if (!this.bt.hasPlayers()) { void this.store.delete('bt'); void this.store.delete('kind'); this.kind = null; this.bt = null }
        else { void this.store.put('bt', this.bt.serialize()); void this.store.put('accounts', [...this.accounts]) }
        return
      }
      if (this.isCash() && this.game) {
        if (!this.game.hasPlayers()) { void this.store.delete('cash'); void this.store.delete('psess'); void this.store.delete('kind'); this.kind = null; this.game = null }
        else { void this.store.put('cash', this.game.serialize()); void this.store.put('psess', [...this.psess]); void this.store.put('accounts', [...this.accounts]); void this.store.put('tableId', this.tableId) }
        return
      }
      if (!this.table.slots.some((s) => s.id)) { void this.store.delete('table'); void this.store.delete('kind'); if (this.kind === 'mahjong') this.kind = null } // an empty room is not worth keeping
      else { void this.store.put('table', this.table.serialize()); void this.store.put('accounts', [...this.accounts]) }
    }, 400)
  }

  /** Once a game is over, save the result (and settle chips for ranked games) exactly once. */
  private async recordIfOver() {
    const t = this.table
    if (!this.envv.DB || !t.game || t.game.phase !== 'over' || !t.matchId || this.recorded === t.matchId) return
    this.recorded = t.matchId
    void this.store.put('recorded', t.matchId)
    const g = t.game
    const ranked = t.config.ranked === true
    try {
      await recordMatch(this.envv.DB, {
        id: t.matchId, game: 'mahjong', rule: t.config.rule, ranked, room: this.name, startedAt: t.startedAt, config: t.config,
        players: g.players.map((p) => ({ seat: p.seat, name: p.name, userId: this.accounts.get(t.slots[p.seat].id ?? '')?.userId ?? null, points: p.points })),
        history: g.history, replay: g.replays,
      })
    } catch (e) { console.error('record failed', e); this.recorded = null }
  }

  private sendPoker(conn: Connection, id: string) {
    const acct = this.accounts.get(id)
    const view = { ...(this.game!.view(id) as object), signedIn: !!acct, balance: null as number | null }
    const msg = { t: 'pview', game: this.kind, view } as unknown as PokerServerMsg
    conn.send(JSON.stringify(msg))
  }
  private send(conn: Connection, m: ServerMsg) { conn.send(JSON.stringify(m)) }

  /** Build the chip table for this room's game and wire its callbacks to the ledger and match history. */
  private startCash(kind: Kind, cfg: { sb?: number; bb?: number; casual?: boolean } | undefined) {
    const casual = cfg?.casual !== false || !this.envv.DB
    let g: CashGame
    if (kind === 'blackjack') {
      g = makeBlackjack(cfg?.bb, casual)
    } else {
      const blinds = BLINDS.find(([sb, bb]) => cfg && sb === cfg.sb && bb === cfg.bb) ?? [DEFAULT_POKER.sb, DEFAULT_POKER.bb]
      const p = new PokerTable({ sb: blinds[0], bb: blinds[1], casual, maxSeats: 6 })
      p.turnTimerMs = 30000
      g = p
    }
    g.onChange(() => { this.broadcastViews(); this.persistSoon() })
    g.onCashout = (id, stack, buyin) => this.cashOut(id, stack, buyin)
    g.onHand = (rec) => { void this.recordHand(rec) }
    this.game = g
  }
  /** a player's seat closed: send their remaining chips back to the ledger (cash tables only) */
  private cashOut(id: string, stack: number, buyin: number) {
    const sess = this.psess.get(id)
    this.psess.delete(id)
    if (!sess || !this.envv.DB) return
    void release(this.envv.DB, sess.userId, buyin, stack, sess.ref, this.kind === 'blackjack' ? { game: 'blackjack', dailyCap: BLACKJACK_DAILY_CAP } : undefined).catch((e) => console.error('release failed', e))
  }
  private async recordHand(rec: HandRecord) {
    const g = this.game
    if (!g || g.config.casual || !this.envv.DB || !this.kind) return
    const dealt = rec.seats.filter((x) => x.id)
    if (dealt.length === 0) return
    try {
      await recordMatch(this.envv.DB, {
        id: `${this.tableId}-${rec.handNo}`, game: this.kind, rule: rec.rule, ranked: true, room: this.name, startedAt: Date.now(), config: g.config,
        players: dealt.map((x) => ({ seat: x.seat, name: x.name, userId: this.psess.get(x.id ?? '')?.userId ?? null, points: rec.net[x.seat] })),
        history: rec.summary, replay: null,
        chips: Object.fromEntries(dealt.map((x) => [x.seat, rec.net[x.seat]])),
      })
    } catch (e) { console.error('hand record failed', e) }
  }
  /** a safety net: if every connection is gone the object may be evicted, so an alarm closes abandoned seats later */
  private scheduleSweep() {
    try { void (this as unknown as { ctx: { storage: { setAlarm(t: number): Promise<void> } } }).ctx.storage.setAlarm(Date.now() + (this.game?.graceMs ?? 60000) + 2000) } catch { /* ignore */ }
  }
  async onAlarm() {
    if (!this.isCash() || !this.game) return
    const waiting = this.game.sweep()
    if (waiting > 0) this.scheduleSweep()
  }

  private startBigTwo() {
    const b = new BigTwoTable()
    b.onChange(() => { this.broadcastViews(); this.persistSoon() })
    b.onOver = (t) => { void this.recordBigTwo(t) }
    this.bt = b
  }
  /** Big Two is over: save it, and for ranked rooms settle chips zero-sum between the signed-in humans (bots never move chips). */
  private async recordBigTwo(t: BigTwoTable) {
    if (!this.envv.DB || !t.result || !t.matchId || this.btRecorded === t.matchId) return
    this.btRecorded = t.matchId; void this.store.put('btRecorded', t.matchId)
    const ranked = t.config.ranked
    const players = t.seats.map((s, i) => ({ seat: i, name: s.name, userId: s.id && !s.bot ? this.accounts.get(s.id)?.userId ?? null : null, points: t.result!.points[i] }))
    const humans = players.filter((p) => p.userId)
    const mean = humans.length ? humans.reduce((a, p) => a + p.points, 0) / humans.length : 0
    const chips: Record<number, number> = {}
    if (ranked && humans.length >= 2) for (const p of humans) chips[p.seat] = Math.round(50 * (p.points - mean))
    try {
      await recordMatch(this.envv.DB, { id: t.matchId, game: 'bigtwo', rule: 'standard', ranked, room: this.name, startedAt: t.startedAt, config: t.config, players, history: { left: t.result.left, winner: t.result.winner }, replay: null, chips, settle: true })
    } catch (e) { console.error('big two record failed', e); this.btRecorded = null }
  }

  private broadcastViews() {
    if (this.kind === 'bigtwo' && this.bt) {
      for (const c of this.getConnections<{ id?: string }>()) { const id = c.state?.id; if (id) c.send(JSON.stringify({ t: 'pview', game: 'bigtwo', view: { ...this.bt.view(id), signedIn: this.accounts.has(id), watching: this.watching() } })) }
      return
    }
    if (this.isCash() && this.game) {
      for (const c of this.getConnections<{ id?: string }>()) {
        const id = c.state?.id
        if (id) this.sendPoker(c, id)
      }
      return
    }
    for (const c of this.getConnections<{ id?: string }>()) {
      const id = c.state?.id
      if (id) this.send(c, { t: 'view', view: { ...this.table.view(id), watching: this.watching() } })
    }
  }

  async onMessage(sender: Connection<{ id?: string }>, raw: WSMessage) {
    let m: ClientMsg
    try { m = JSON.parse(String(raw)) } catch { return }
    if (!m || typeof m !== 'object' || typeof (m as { t?: unknown }).t !== 'string') return
    try { await this.handle(m, sender) } catch (e) { console.error('handler error', e) }
  }

  private async handle(m: ClientMsg, sender: Connection<{ id?: string }>) {
    if (m.t === 'ping') return this.send(sender, { t: 'pong', ts: Number(m.ts) || 0 })
    if (m.t === 'join') {
      if (typeof m.id !== 'string' || !m.id || m.id.length > 64) return this.send(sender, { t: 'error', message: 'bad_id' })
      const id = m.id
      const want: Kind = m.game === 'holdem' || m.game === 'blackjack' || m.game === 'bigtwo' ? m.game : 'mahjong'
      const pend = this.livePending()
      if (pend && pend.game !== want) return this.send(sender, { t: 'error', message: 'wrong_game:' + pend.game })
      let create = m.create === true
      if (!this.kind) {
        if (!create && !pend) return this.send(sender, { t: 'error', message: 'room_not_found' })
        this.kind = want
        void this.store.put('kind', want)
        if (CASH_KINDS.includes(want)) this.startCash(want, pend ? (pend.cfg as { sb?: number; bb?: number; casual?: boolean }) : m.pcfg)
        if (want === 'bigtwo') this.startBigTwo()
        create = true
      } else if (this.kind !== want) return this.send(sender, { t: 'error', message: 'wrong_game:' + this.kind })
      else if (pend && !this.occupied()) create = true // two people arriving together: both may be "first"
      if (this.isCash()) return this.joinCash(m, sender, create)
      if (this.kind === 'bigtwo') return this.joinBigTwo(m, sender, create)
      const verdict = this.table.admit(id, create)
      if (verdict !== 'ok') return this.send(sender, { t: 'error', message: verdict })
      // a valid account session turns this player into a signed-in one (named after the account); anything else plays as a guest
      let name = typeof m.name === 'string' ? m.name : 'Player'
      if (typeof m.token === 'string' && m.token && this.envv.DB) {
        const u = await userFromToken(this.envv.DB, m.token)
        if (u) {
          const other = [...this.accounts].find(([cid, a]) => a.userId === u.id && cid !== id && this.table.slots.some((s) => s.id === cid))
          if (other) return this.send(sender, { t: 'error', message: 'already_seated' })
          this.accounts.set(id, { userId: u.id, name: u.name }); name = u.name
        } else this.accounts.delete(id)
      } else this.accounts.delete(id)
      // asked to watch, or the table is full: watch instead of being turned away
      const seat = m.watch === true ? -1 : this.table.join(id, name)
      if (seat < 0) { this.watchers.add(id); this.guestNames.set(id, name) } else this.watchers.delete(id)
      sender.setState({ id })
      this.applyPending(id)
      this.broadcastViews()
      this.sendTalkLog(sender)
      return
    }
    const id = sender.state?.id
    if (!id) return
    if (m.t === 'talk') return this.talk(id, sender, m.text)
    if (this.kind === 'bigtwo') { if (m.t === 'p') this.btMsg(id, sender, m.m as unknown as BtMsg); else if (m.t === 'bye') this.bt?.leave(id, true); return }
    if (this.isCash()) { if (m.t === 'p') await this.cashMsg(id, sender, m.m); else if (m.t === 'bye') { this.game?.standUp(id); this.game?.disconnect(id) } return }
    switch (m.t) {
      case 'config': {
        const c = m.config && typeof m.config === 'object' ? { ...m.config } : {}
        if (c.ranked === true && !this.accounts.has(id)) { delete c.ranked; this.send(sender, { t: 'error', message: 'ranked_needs_signin' }) }
        this.table.setConfig(id, c); break
      }
      case 'start': {
        if (this.table.config.ranked && id === this.table.hostId) {
          const humans = this.table.slots.filter((s) => s.id)
          if (humans.length < 2 || humans.some((s) => !this.accounts.has(s.id!))) return this.send(sender, { t: 'error', message: 'ranked_needs_players' })
        }
        this.table.start(id); break
      }
      case 'act': this.table.turnAction(id, m.a); break
      case 'decide': this.table.decide(id, m.d); break
      case 'swap': this.table.swap(id, Array.isArray(m.tiles) ? m.tiles.map(Number) : []); break
      case 'void': this.table.pickVoid(id, Number(m.suit)); break
      case 'ack': this.table.ack(id); break
      case 'lobby': this.table.backToLobby(id); break
      case 'toggleBot': this.table.toggleBot(id, m.seat); break
      case 'chat': this.table.chat(id, String(m.key)); break
      case 'say': this.table.say(id, m.text); break
      case 'bye': this.table.leave(id, true); break
      case 'here': this.table.here(id); break
      case 'sit': {
        if (this.table.seatOf(id) >= 0) { this.watchers.delete(id); break }
        if (this.table.join(id, this.accounts.get(id)?.name ?? this.guestNames.get(id) ?? 'Player') < 0) return this.send(sender, { t: 'error', message: 'room_full' })
        this.watchers.delete(id); this.broadcastViews(); break
      }
    }
  }

  /** Table chat: one message a second at most, 140 characters, plain text. */
  private talk(id: string, sender: Connection<{ id?: string }>, raw: unknown) {
    const text = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)
    if (!text) return
    const now = Date.now()
    if (now - (this.lastTalk.get(id) ?? 0) < 1000) return this.send(sender, { t: 'error', message: 'slow_down' })
    this.lastTalk.set(id, now)
    const seatName = this.kind === 'bigtwo' ? this.bt?.seats.find((x) => x.id === id)?.name : this.game ? this.guestNames.get(id) : this.table.slots.find((x) => x.id === id)?.name
    const name = this.accounts.get(id)?.name ?? seatName ?? this.guestNames.get(id) ?? 'Player'
    const msg = { n: ++this.talkN, name, text }
    this.talkLog.push(msg); if (this.talkLog.length > 40) this.talkLog.shift()
    for (const c of this.getConnections<{ id?: string }>()) if (c.state?.id) c.send(JSON.stringify({ t: 'talk', msg }))
  }
  private sendTalkLog(conn: Connection) { if (this.talkLog.length) conn.send(JSON.stringify({ t: 'talklog', msgs: this.talkLog })) }
  private async joinBigTwo(m: Extract<ClientMsg, { t: 'join' }>, sender: Connection<{ id?: string }>, create: boolean) {
    const b = this.bt!, id = m.id
    const verdict = b.admit(id, create)
    if (verdict !== 'ok') return this.send(sender, { t: 'error', message: verdict })
    let name = typeof m.name === 'string' ? m.name : 'Player'
    if (typeof m.token === 'string' && m.token && this.envv.DB) {
      const u = await userFromToken(this.envv.DB, m.token)
      if (u) {
        const other = [...this.accounts].find(([cid, a]) => a.userId === u.id && cid !== id && b.seatOf(cid) >= 0)
        if (other) return this.send(sender, { t: 'error', message: 'already_seated' })
        this.accounts.set(id, { userId: u.id, name: u.name }); name = u.name
      } else this.accounts.delete(id)
    } else this.accounts.delete(id)
    // asked to watch, or no seat is free: watch instead of being turned away
    if (m.watch === true || b.join(id, name) < 0) this.watchers.add(id); else this.watchers.delete(id)
    sender.setState({ id })
    this.guestNames.set(id, name)
    this.applyPending(id)
    this.broadcastViews()
    this.sendTalkLog(sender)
  }
  private btMsg(id: string, sender: Connection<{ id?: string }>, m: BtMsg) {
    const b = this.bt!
    if (!m || typeof m !== 'object') return
    const err = (message: string) => this.send(sender, { t: 'error', message })
    if (m.k === 'play') { const e = b.play(id, Array.isArray(m.cards) ? m.cards.map(Number) : []); if (e) err(e); return }
    if (m.k === 'pass') { const e = b.pass(id); if (e) err(e); return }
    if (m.k === 'config') {
      const c = { ...m.config }
      if (c.ranked === true && !this.accounts.has(id)) { delete c.ranked; err('ranked_needs_signin') }
      b.setConfig(id, c); return
    }
    if (m.k === 'start') {
      if (b.config.ranked && id === b.hostId) {
        const humans = b.seats.filter((s) => s.id)
        if (humans.length < 2 || humans.some((s) => !this.accounts.has(s.id!))) return err('ranked_needs_players')
      }
      b.start(id); return
    }
    if (m.k === 'sit') {
      if (b.seatOf(id) >= 0) { this.watchers.delete(id); return }
      if (b.join(id, this.accounts.get(id)?.name ?? this.guestNames.get(id) ?? 'Player') < 0) return err('room_full')
      this.watchers.delete(id); this.broadcastViews(); return
    }
    if (m.k === 'lobby') { b.backToLobby(id); return }
  }
  private async joinCash(m: Extract<ClientMsg, { t: 'join' }>, sender: Connection<{ id?: string }>, create: boolean) {
    const p = this.game!, id = m.id
    const verdict = p.admit(id, create)
    if (verdict !== 'ok') return this.send(sender, { t: 'error', message: verdict })
    if (typeof m.token === 'string' && m.token && this.envv.DB) {
      const u = await userFromToken(this.envv.DB, m.token)
      if (u) {
        const other = [...this.accounts].find(([cid, a]) => a.userId === u.id && cid !== id && (p.seatOf(cid) >= 0 || p.members.has(cid)))
        if (other) return this.send(sender, { t: 'error', message: 'already_seated' })
        this.accounts.set(id, { userId: u.id, name: u.name })
      } else this.accounts.delete(id)
    } else this.accounts.delete(id)
    sender.setState({ id })
    const name = this.accounts.get(id)?.name ?? (typeof m.name === 'string' ? m.name : 'Player')
    this.guestNames.set(id, name)
    p.join(id)
    this.applyPending(id)
    this.sendPoker(sender, id)
    this.sendTalkLog(sender)
  }
  private guestNames = new Map<string, string>()
  /** The room's settings go onto the table the moment someone sits at it, and the room's host becomes the table's host as soon as they arrive. */
  private applyPending(id: string) {
    const pend = this.livePending()
    if (!pend || this.kind !== pend.game) return
    if (this.kind === 'mahjong') {
      if (!pend.applied && this.table.hostId) { this.table.setConfig(this.table.hostId, pend.cfg as never); pend.applied = true }
      if (id === pend.host && this.table.seatOf(id) >= 0) { this.table.hostId = id; if (pend.applied) this.table.setConfig(id, pend.cfg as never); this.pending = null; void this.store.delete('pending'); return }
    } else if (this.kind === 'bigtwo' && this.bt) {
      if (!pend.applied && this.bt.hostId) { this.bt.setConfig(this.bt.hostId, pend.cfg as never); pend.applied = true }
      if (id === pend.host && this.bt.seatOf(id) >= 0) { this.bt.hostId = id; this.bt.setConfig(id, pend.cfg as never); this.pending = null; void this.store.delete('pending'); return }
    } else { this.pending = null; void this.store.delete('pending'); return } // chip tables take their settings when they are created
    void this.store.put('pending', pend)
  }

  private async cashMsg(id: string, sender: Connection<{ id?: string }>, m: PokerMsg) {
    const p = this.game!
    const err = (message: string) => this.send(sender, { t: 'error', message })
    const acct = this.accounts.get(id)
    const db = this.envv.DB
    if (!m || typeof m !== 'object') return
    if (m.k === 'sit') {
      const name = acct?.name ?? this.guestNames.get(id) ?? 'Player'
      if (p.config.casual) { // free temporary stack, nothing is saved
        const r = p.sit(id, name, p.casualStack)
        if (!r.ok) err(r.error)
        return
      }
      if (!acct || !db) return err('signin_required')
      const amount = Math.floor(Number(m.buyin))
      const bad = p.canSit(id, amount)
      if (bad) return err(bad)
      const ref = `${this.tableId}:${id}:${Date.now().toString(36)}`
      if (!(await hold(db, acct.userId, amount, ref + ':b0'))) return err('not_enough_chips')
      const r = p.sit(id, name, amount)
      if (!r.ok) { await release(db, acct.userId, amount, amount, ref).catch(() => {}); return err(r.error) }
      this.psess.set(id, { userId: acct.userId, ref, n: 0 })
      return
    }
    if (m.k === 'rebuy') {
      const amount = Math.floor(Number(m.amount))
      if (p.config.casual) return
      const sess = this.psess.get(id)
      if (!sess || !db || amount <= 0 || amount > p.rebuyRoom(id)) return err('bad_buyin')
      sess.n++
      if (!(await hold(db, sess.userId, amount, `${sess.ref}:b${sess.n}`))) { sess.n--; return err('not_enough_chips') }
      if (!p.rebuy(id, amount)) await release(db, sess.userId, amount, amount, `${sess.ref}:x${sess.n}`).catch(() => {})
      return
    }
    if (m.k === 'act') { const e = p.act(id, m.a); if (e) err(e); return }
    if (m.k === 'stand') { p.standUp(id); return }
    if (m.k === 'out') { p.setOut(id, m.out === true); return }
  }

  onClose(conn: Connection<{ id?: string }>) {
    const id = conn.state?.id
    if (!id) return
    // only drop the seat if no other live socket belongs to the same player
    const still = [...this.getConnections<{ id?: string }>()].some((c) => c.id !== conn.id && c.state?.id === id)
    if (still) return
    if (this.isCash() && this.game) { this.game.disconnect(id); this.scheduleSweep(); return }
    if (this.kind === 'bigtwo' && this.bt) { this.bt.leave(id); return }
    this.table.leave(id)
  }
}

export default {
  /** daily: drop replay logs older than 90 days (summaries stay) */
  async scheduled(_e: unknown, env: Env): Promise<void> { if (env.DB) await trimReplays(env.DB) },
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.endsWith('/__prepare')) return new Response('Not found', { status: 404 }) // only a room may prepare a table
    const api = await handleApi(request, env)
    if (api) return api
    return (await routePartykitRequest(request, env as never)) || new Response('Kiiro Games server', { status: 200 })
  },
}
