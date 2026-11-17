import { routePartykitRequest, Server, type Connection, type WSMessage } from 'partyserver'
import { Table } from '../src/engine/table'
import type { ClientMsg, ServerMsg } from '../src/net/protocol'

type Env = Record<string, unknown>

/** One Durable Object (room) == one table. The server owns the game; clients only ever see their own view. */
export class Main extends Server<Env> {
  table = new Table()

  onStart() {
    this.table.onChange(() => this.broadcastViews())
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
    if (m.t === 'join') {
      const id = String(m.id).slice(0, 40)
      const seat = this.table.join(id, String(m.name ?? 'Player'))
      if (seat < 0) return this.send(sender, { t: 'error', message: 'Room is full or the game has already started.' })
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
      case 'ack': this.table.ack(id); break
      case 'lobby': this.table.backToLobby(id); break
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
