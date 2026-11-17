import type * as Party from 'partykit/server'
import { Table } from '../src/engine/table'
import type { ClientMsg, ServerMsg } from '../src/net/protocol'

/** One PartyKit room == one table. The server owns the game; clients only ever see their own view. */
export default class MahjongServer implements Party.Server {
  table = new Table()
  constructor(readonly room: Party.Room) {
    this.table.onChange(() => this.broadcast())
  }

  private send(conn: Party.Connection, m: ServerMsg) { conn.send(JSON.stringify(m)) }

  private broadcast() {
    for (const c of this.room.getConnections<{ id?: string }>()) {
      const id = c.state?.id
      if (id) this.send(c, { t: 'view', view: this.table.view(id) })
    }
  }

  onMessage(raw: string, sender: Party.Connection<{ id?: string }>) {
    let m: ClientMsg
    try { m = JSON.parse(raw) } catch { return }
    if (m.t === 'join') {
      const id = String(m.id).slice(0, 40)
      const seat = this.table.join(id, String(m.name ?? 'Player'))
      if (seat < 0) return this.send(sender, { t: 'error', message: 'Room is full or the game has already started.' })
      sender.setState({ id })
      this.broadcast()
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

  onClose(conn: Party.Connection<{ id?: string }>) {
    const id = conn.state?.id
    if (!id) return
    // only drop the seat if no other live socket belongs to the same player
    const still = [...this.room.getConnections<{ id?: string }>()].some((c) => c.id !== conn.id && c.state?.id === id)
    if (!still) this.table.leave(id)
  }
}
