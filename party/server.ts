import { routePartykitRequest, Server, type Connection, type WSMessage } from 'partyserver'
import { Table } from '../src/engine/table'
import type { ClientMsg, ServerMsg } from '../src/net/protocol'

type Env = Record<string, unknown>

/** One Durable Object (room) == one table. The server owns the game; clients only ever see their own view. */
export class Main extends Server<Env> {
  table = new Table()

  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private store: { get<T>(k: string): Promise<T | undefined>; put(k: string, v: unknown): Promise<void>; delete(k: string): Promise<unknown> }
  constructor(ctx: ConstructorParameters<typeof Server>[0], env: Env) { super(ctx, env); this.store = (ctx as unknown as { storage: Main['store'] }).storage }

  async onStart() {
    this.table.turnTimerMs = 30000
    // a restart or redeploy evicts this object from memory: bring the room back from storage
    try {
      const saved = await this.store.get<string>('table')
      if (saved) this.table.restore(saved)
    } catch (e) { console.error('restore failed', e) }
    this.table.onChange(() => { this.broadcastViews(); this.persistSoon() })
  }

  private persistSoon() {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      if (!this.table.slots.some((s) => s.id)) void this.store.delete('table') // an empty room is not worth keeping
      else void this.store.put('table', this.table.serialize())
    }, 400)
  }

  private send(conn: Connection, m: ServerMsg) { conn.send(JSON.stringify(m)) }

  private broadcastViews() {
    for (const c of this.getConnections<{ id?: string }>()) {
      const id = c.state?.id
      if (id) this.send(c, { t: 'view', view: this.table.view(id) })
    }
  }

  onMessage(sender: Connection<{ id?: string }>, raw: WSMessage) {
    let m: ClientMsg
    try { m = JSON.parse(String(raw)) } catch { return }
    if (!m || typeof m !== 'object' || typeof (m as { t?: unknown }).t !== 'string') return
    try { this.handle(m, sender) } catch (e) { console.error('handler error', e) }
  }

  private handle(m: ClientMsg, sender: Connection<{ id?: string }>) {
    if (m.t === 'ping') return this.send(sender, { t: 'pong', ts: Number(m.ts) || 0 })
    if (m.t === 'join') {
      if (typeof m.id !== 'string' || !m.id || m.id.length > 64) return this.send(sender, { t: 'error', message: 'bad_id' })
      const id = m.id
      const verdict = this.table.admit(id, m.create === true)
      if (verdict !== 'ok') return this.send(sender, { t: 'error', message: verdict })
      const seat = this.table.join(id, typeof m.name === 'string' ? m.name : 'Player')
      if (seat < 0) return this.send(sender, { t: 'error', message: 'room_full' })
      sender.setState({ id })
      this.broadcastViews()
      return
    }
    const id = sender.state?.id
    if (!id) return
    switch (m.t) {
      case 'config': this.table.setConfig(id, m.config); break
      case 'start': this.table.start(id); break
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
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routePartykitRequest(request, env as never)) || new Response('Kiiro Mahjong server', { status: 200 })
  },
}
