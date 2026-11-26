import PartySocket from 'partysocket'
import { Table, type RoomConfig, type TableView } from '../engine/table'
import type { ClientMsg, ServerMsg } from './protocol'
import { getToken } from '../../../account/api'

export interface Conn {
  send(m: ClientMsg): void
  close(): void
  /** debug/testing: drop the connection and reconnect after `ms` */
  drop?(ms: number): void
  /** try to reconnect right now (the socket also retries on its own with back-off) */
  reconnect?(): void
}
export type Status = 'connecting' | 'open' | 'closed'
export interface Handlers {
  onView(v: TableView): void
  onStatus(s: Status): void
  onError(m: string): void
  onLatency?(ms: number): void
  onTalk?(m: { n: number; name: string; text: string }): void
  onTalkLog?(m: { n: number; name: string; text: string }[]): void
}

export function getClientId(): string {
  try {
    let id = localStorage.getItem('kiiro-id')
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('kiiro-id', id)
    }
    return id
  } catch {
    return Math.random().toString(36).slice(2)
  }
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
        case 'act':
          table.turnAction(id, m.a)
          break
        case 'decide':
          table.decide(id, m.d)
          break
        case 'swap':
          table.swap(id, m.tiles)
          break
        case 'void':
          table.pickVoid(id, m.suit)
          break
        case 'ack':
          table.ack(id)
          break
        case 'lobby':
          table.backToLobby(id)
          break
        case 'config':
          table.setConfig(id, m.config)
          break
        case 'start':
          table.start(id)
          break
        case 'toggleBot':
          table.toggleBot(id, m.seat)
          break
        case 'chat':
          table.chat(id, m.key)
          break
        case 'say':
          table.say(id, m.text)
          break
        case 'here':
          table.here(id)
          break
      }
    },
    close() {
      table.leave(id)
      table.game = null
    },
  }
}

// accept the host with or without https:// and a trailing slash
const envHost = ((import.meta.env.VITE_PARTYKIT_HOST as string | undefined) || '')
  .trim()
  .replace(/^(https?|wss?):\/\//, '')
  .replace(/\/+$/, '')
// dev default: the machine serving the page (so a phone on the LAN can use `npm run party:dev` on the same computer)
export const PARTY_HOST = envHost || `${location.hostname || 'localhost'}:8787`

export function connectRemote(room: string, id: string, name: string, h: Handlers, create = false, watch = false): Conn {
  const ws = new PartySocket({ host: PARTY_HOST, room: room.toLowerCase() })
  h.onStatus('connecting')
  let lastPong = 0
  let lastSeen = Date.now() // any message from the server proves the link is alive
  let closed = false // set by close(): from then on nothing this connection does may reach the app (no retries, no views)
  let beatTimer: ReturnType<typeof setInterval> | null = null
  let watchdog: ReturnType<typeof setTimeout> | null = null
  const beat = () => {
    if (ws.readyState !== 1) return
    const sent = Date.now()
    try {
      ws.send(JSON.stringify({ t: 'ping', ts: sent } satisfies ClientMsg))
    } catch {
      return
    }
    if (watchdog) clearTimeout(watchdog)
    // no answer within 15 s: the connection is dead even if the browser still says "open" (phone slept, wifi changed). One slow answer is not a dead link.
    watchdog = setTimeout(() => {
      if (!closed && lastPong < sent && Date.now() - lastSeen > 15000) {
        h.onStatus('closed')
        ws.reconnect()
        startRetry()
      }
    }, 15000)
  }
  // automatic recovery: while the connection is down, keep trying every few seconds (the socket also backs off on its own)
  let retryTimer: ReturnType<typeof setInterval> | null = null
  let dropping = false
  const startRetry = () => {
    if (retryTimer || dropping || closed) return
    retryTimer = setInterval(() => {
      if (closed) {
        stopRetry()
        return
      }
      if (ws.readyState !== 1 && ws.readyState !== 0) ws.reconnect()
    }, 3500)
  }
  const stopRetry = () => {
    if (retryTimer) clearInterval(retryTimer)
    retryTimer = null
  }
  const wake = () => {
    if (closed) return
    if (document.visibilityState === 'visible') {
      if (ws.readyState === 1) beat()
      else ws.reconnect()
    }
  }
  const online = () => {
    if (!closed) ws.reconnect()
  }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('online', online)
  ws.addEventListener('open', () => {
    stopRetry()
    h.onStatus('open')
    ws.send(
      JSON.stringify({
        t: 'join',
        id,
        name,
        ...(create ? { create: true } : {}),
        ...(watch ? { watch: true } : {}),
        ...(getToken() ? { token: getToken()! } : {}),
      } satisfies ClientMsg),
    )
    lastPong = Date.now()
    beat()
    if (beatTimer) clearInterval(beatTimer)
    beatTimer = setInterval(beat, 10000)
  })
  ws.addEventListener('close', () => {
    if (closed) return
    setTimeout(() => {
      if (!closed && ws.readyState !== 1) h.onStatus('closed')
    }, 2500)
    if (beatTimer) clearInterval(beatTimer)
    beatTimer = null
    startRetry()
  })
  ws.addEventListener('message', (e) => {
    if (closed) return
    lastSeen = Date.now()
    const m = JSON.parse(e.data as string) as ServerMsg
    if (m.t === 'view') h.onView(m.view)
    else if (m.t === 'pong') {
      lastPong = Date.now()
      if (watchdog) clearTimeout(watchdog)
      h.onLatency?.(Date.now() - m.ts)
    } else if (m.t === 'talk') h.onTalk?.(m.msg)
    else if (m.t === 'talklog') h.onTalkLog?.(m.msgs)
    else if (m.message !== 'slow_down') h.onError(m.message) // the chat says so itself
  })
  return {
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => {
      closed = true
      if (beatTimer) clearInterval(beatTimer)
      if (watchdog) clearTimeout(watchdog)
      stopRetry()
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', online)
      ws.close()
    },
    drop: (ms) => {
      dropping = true
      stopRetry()
      ws.close()
      setTimeout(() => {
        dropping = false
        ws.reconnect()
      }, ms)
    },
    reconnect: () => {
      h.onStatus('connecting')
      ws.reconnect()
    },
  }
}
