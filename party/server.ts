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
import type { CashGame, HandRecord } from '../src/games/shared/cash'
import type { PokerMsg, PokerServerMsg } from '../src/games/holdem/net/protocol'

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
  private isCash() { return this.kind !== null && CASH_KINDS.includes(this.kind) }
  /** cash-table sessions: client id -> ledger account and the reference that ties the buy-in to the cash-out */
  psess = new Map<string, { userId: string; ref: string; n: number }>()
  private tableId = Math.random().toString(36).slice(2, 10)

  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private store: { get<T>(k: string): Promise<T | undefined>; put(k: string, v: unknown): Promise<void>; delete(k: string): Promise<unknown> }
  private envv: Env
  constructor(ctx: ConstructorParameters<typeof Server>[0], env: Env) { super(ctx, env); this.envv = env; this.store = (ctx as unknown as { storage: Main['store'] }).storage }

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
      } else if (saved) this.table.restore(saved)
      const acc = await this.store.get<[string, { userId: string; name: string }][]>('accounts')
      if (acc) this.accounts = new Map(acc)
      this.recorded = (await this.store.get<string>('recorded')) ?? null
    } catch (e) { console.error('restore failed', e) }
    this.table.onChange(() => { if (!this.isCash()) { this.broadcastViews(); this.persistSoon(); void this.recordIfOver() } })
  }

  private persistSoon() {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
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

  private broadcastViews() {
    if (this.isCash() && this.game) {
      for (const c of this.getConnections<{ id?: string }>()) {
        const id = c.state?.id
        if (id) this.sendPoker(c, id)
      }
      return
    }
    for (const c of this.getConnections<{ id?: string }>()) {
      const id = c.state?.id
      if (id) this.send(c, { t: 'view', view: this.table.view(id) })
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
      if (!this.kind) {
        if (m.create !== true) return this.send(sender, { t: 'error', message: 'room_not_found' })
        this.kind = want
        void this.store.put('kind', want)
        if (CASH_KINDS.includes(want)) this.startCash(want, m.pcfg)
      } else if (this.kind !== want) return this.send(sender, { t: 'error', message: 'wrong_game:' + this.kind })
      if (this.isCash()) return this.joinCash(m, sender)
      const verdict = this.table.admit(id, m.create === true)
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
      const seat = this.table.join(id, name)
      if (seat < 0) return this.send(sender, { t: 'error', message: 'room_full' })
      sender.setState({ id })
      this.broadcastViews()
      return
    }
    const id = sender.state?.id
    if (!id) return
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
    }
  }

  private async joinCash(m: Extract<ClientMsg, { t: 'join' }>, sender: Connection<{ id?: string }>) {
    const p = this.game!, id = m.id
    const verdict = p.admit(id, m.create === true)
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
    this.sendPoker(sender, id)
  }
  private guestNames = new Map<string, string>()

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
    this.table.leave(id)
  }
}

export default {
  /** daily: drop replay logs older than 90 days (summaries stay) */
  async scheduled(_e: unknown, env: Env): Promise<void> { if (env.DB) await trimReplays(env.DB) },
  async fetch(request: Request, env: Env): Promise<Response> {
    const api = await handleApi(request, env)
    if (api) return api
    return (await routePartykitRequest(request, env as never)) || new Response('Kiiro Games server', { status: 200 })
  },
}
