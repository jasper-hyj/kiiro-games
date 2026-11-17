import PartySocket from 'partysocket'
import { Table, type RoomConfig, type TableView } from '../engine/table'
import type { ClientMsg, ServerMsg } from './protocol'

export interface Conn {
  send(m: ClientMsg): void
  close(): void
  /** debug/testing: drop the connection and reconnect after `ms` */
  drop?(ms: number): void
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
  const sp = Number(new URLSearchParams(location.search).get('speed')) // debug: ?speed=0.03 makes bots play fast
  if (sp > 0 && sp <= 1) table.speed = sp
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

const envHost = (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) || ''
// dev default: the machine serving the page (so a phone on the LAN can use `npm run party:dev` on the same computer)
export const PARTY_HOST = envHost || `${location.hostname || 'localhost'}:8787`
/** false on a deployed site that has no VITE_PARTYKIT_HOST (online rooms cannot work there) */
export const onlineConfigured = !!envHost || import.meta.env.DEV || ['localhost', '127.0.0.1', ''].includes(location.hostname)

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
  return {
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
    drop: (ms) => { ws.close(); setTimeout(() => ws.reconnect(), ms) },
  }
}
