import PartySocket from 'partysocket'
import { Table, type RoomConfig, type TableView } from '../engine/table'
import type { ClientMsg, ServerMsg } from './protocol'

export interface Conn {
  send(m: ClientMsg): void
  close(): void
  /** debug/testing: drop the connection and reconnect after `ms` */
  drop?(ms: number): void
  /** try to reconnect right now (the socket also retries on its own with back-off) */
  reconnect?(): void
}
export type Status = 'connecting' | 'open' | 'closed'
export interface Handlers { onView(v: TableView): void; onStatus(s: Status): void; onError(m: string): void; onLatency?(ms: number): void }

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
        case 'swap': table.swap(id, m.tiles); break
        case 'void': table.pickVoid(id, m.suit); break
        case 'ack': table.ack(id); break
        case 'lobby': table.backToLobby(id); break
        case 'config': table.setConfig(id, m.config); break
        case 'start': table.start(id); break
        case 'toggleBot': table.toggleBot(id, m.seat); break
        case 'chat': table.chat(id, m.key); break
        case 'here': table.here(id); break
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
  let lastPong = 0
  let beatTimer: ReturnType<typeof setInterval> | null = null
  let watchdog: ReturnType<typeof setTimeout> | null = null
  const beat = () => {
    if (ws.readyState !== 1) return
    const sent = Date.now()
    try { ws.send(JSON.stringify({ t: 'ping', ts: sent } satisfies ClientMsg)) } catch { return }
    if (watchdog) clearTimeout(watchdog)
    // no answer within 5 s: the connection is dead even if the browser still says "open" (phone slept, wifi changed)
    watchdog = setTimeout(() => { if (lastPong < sent) { h.onStatus('closed'); ws.reconnect(); startRetry() } }, 5000)
  }
  // automatic recovery: while the connection is down, keep trying every few seconds (the socket also backs off on its own)
  let retryTimer: ReturnType<typeof setInterval> | null = null
  let dropping = false
  const startRetry = () => { if (retryTimer || dropping) return; retryTimer = setInterval(() => { if (ws.readyState !== 1 && ws.readyState !== 0) ws.reconnect() }, 3500) }
  const stopRetry = () => { if (retryTimer) clearInterval(retryTimer); retryTimer = null }
  const wake = () => { if (document.visibilityState === 'visible') { if (ws.readyState === 1) beat(); else ws.reconnect() } }
  const online = () => ws.reconnect()
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('online', online)
  ws.addEventListener('open', () => {
    stopRetry()
    h.onStatus('open')
    ws.send(JSON.stringify({ t: 'join', id, name } satisfies ClientMsg))
    lastPong = Date.now()
    beat()
    if (beatTimer) clearInterval(beatTimer)
    beatTimer = setInterval(beat, 10000)
  })
  ws.addEventListener('close', () => { h.onStatus('closed'); if (beatTimer) clearInterval(beatTimer); beatTimer = null; startRetry() })
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data as string) as ServerMsg
    if (m.t === 'view') h.onView(m.view)
    else if (m.t === 'pong') { lastPong = Date.now(); if (watchdog) clearTimeout(watchdog); h.onLatency?.(Date.now() - m.ts) }
    else h.onError(m.message)
  })
  return {
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => {
      if (beatTimer) clearInterval(beatTimer)
      if (watchdog) clearTimeout(watchdog)
      stopRetry()
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', online)
      ws.close()
    },
    drop: (ms) => { dropping = true; stopRetry(); ws.close(); setTimeout(() => { dropping = false; ws.reconnect() }, ms) },
    reconnect: () => { h.onStatus('connecting'); ws.reconnect() },
  }
}
