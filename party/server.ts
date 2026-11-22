import { routePartykitRequest, Server, type Connection, type WSMessage } from 'partyserver'
import { Table } from '../src/games/mahjong/engine/table'
import type { ClientMsg, ServerMsg } from '../src/games/mahjong/net/protocol'
import type { Env } from './d1'
import { handleApi } from './api'
import { userFromToken } from './auth'
import { recordMatch, trimReplays } from './matches'

/** One Durable Object (room) == one table. The server owns the game; clients only ever see their own view. */
export class Main extends Server<Env> {
  table = new Table()
  /** signed-in players in this room: client id -> account (guests are simply absent) */
  accounts = new Map<string, { userId: string; name: string }>()
  private recorded: string | null = null

  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private store: { get<T>(k: string): Promise<T | undefined>; put(k: string, v: unknown): Promise<void>; delete(k: string): Promise<unknown> }
  private envv: Env
  constructor(ctx: ConstructorParameters<typeof Server>[0], env: Env) { super(ctx, env); this.envv = env; this.store = (ctx as unknown as { storage: Main['store'] }).storage }

  async onStart() {
    this.table.turnTimerMs = 30000
    // a restart or redeploy evicts this object from memory: bring the room back from storage
    try {
      const saved = await this.store.get<string>('table')
      if (saved) this.table.restore(saved)
      const acc = await this.store.get<[string, { userId: string; name: string }][]>('accounts')
      if (acc) this.accounts = new Map(acc)
      this.recorded = (await this.store.get<string>('recorded')) ?? null
    } catch (e) { console.error('restore failed', e) }
    this.table.onChange(() => { this.broadcastViews(); this.persistSoon(); void this.recordIfOver() })
  }

  private persistSoon() {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      if (!this.table.slots.some((s) => s.id)) void this.store.delete('table') // an empty room is not worth keeping
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

  private send(conn: Connection, m: ServerMsg) { conn.send(JSON.stringify(m)) }

  private broadcastViews() {
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

  onClose(conn: Connection<{ id?: string }>) {
    const id = conn.state?.id
    if (!id) return
    // only drop the seat if no other live socket belongs to the same player
    const still = [...this.getConnections<{ id?: string }>()].some((c) => c.id !== conn.id && c.state?.id === id)
    if (!still) this.table.leave(id)
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
