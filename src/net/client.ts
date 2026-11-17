import PartySocket from 'partysocket'
import { Table, type RoomConfig, type TableView } from '../engine/table'
import type { ClientMsg, ServerMsg } from './protocol'

export interface Conn {
  send(m: ClientMsg): void
  close(): void
}
export type Status = 'connecting' | 'open' | 'closed'
export interface Handlers { onView(v: TableView): void; onStatus(s: Status): void; onError(m: string): void }

export function getClientId(): string {
  try {
    let id = localStorage.getItem('kiiro-id')
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('kiiro-id', id) }
    return id
  } catch { return Math.random().toString(36).slice(2) }
}

/** Runs the whole table inside the browser (single player vs bots). */
export function connectLocal(id: string, name: string, config: RoomConfig, h: Handlers): Conn {
  const table = new Table(config)
  table.onChange(() => h.onView(table.view(id)))
  table.join(id, name)
  table.start(id)
  h.onStatus('open')
  h.onView(table.view(id))
  return {
    send(m) {
      switch (m.t) {
        case 'act': table.turnAction(id, m.a); break
        case 'decide': table.decide(id, m.d); break
        case 'ack': table.ack(id); break
        case 'lobby': table.backToLobby(id); break
        case 'config': table.setConfig(id, m.config); break
        case 'start': table.start(id); break
        case 'toggleBot': table.toggleBot(id, m.seat); break
        case 'chat': table.chat(id, m.key); break
      }
    },
    close() { table.leave(id); table.game = null },
  }
}

export const PARTY_HOST = (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) ?? 'localhost:8787'

export function connectRemote(room: string, id: string, name: string, h: Handlers): Conn {
  const ws = new PartySocket({ host: PARTY_HOST, room: room.toLowerCase() })
  h.onStatus('connecting')
  ws.addEventListener('open', () => {
    h.onStatus('open')
    ws.send(JSON.stringify({ t: 'join', id, name } satisfies ClientMsg))
  })
  ws.addEventListener('close', () => h.onStatus('closed'))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data as string) as ServerMsg
    if (m.t === 'view') h.onView(m.view)
    else h.onError(m.message)
  })
  return { send: (m) => ws.send(JSON.stringify(m)), close: () => ws.close() }
}
