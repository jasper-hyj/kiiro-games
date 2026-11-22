import PartySocket from 'partysocket'
import { PARTY_HOST } from '../../mahjong/net/client'
import { getToken } from '../../../account/api'
import type { PokerMsg, PokerServerMsg } from './protocol'
import type { PokerView } from '../engine/table'

export type HoldemView = PokerServerMsg['view']
export type Status = 'connecting' | 'open' | 'closed'
export interface Handlers { onView(v: HoldemView): void; onStatus(s: Status): void; onError(m: string): void }
export interface PokerConn { send(m: PokerMsg): void; close(): void }

export function getClientId(): string {
  try {
    let id = localStorage.getItem('kiiro-id')
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('kiiro-id', id) }
    return id
  } catch { return Math.random().toString(36).slice(2) }
}

/** Connects to a Hold'em room. The same socket and room-code space as Mahjong; the first player to create a code decides the game. */
export function connectHoldem(room: string, id: string, name: string, h: Handlers, create?: { sb: number; bb: number; casual: boolean }): PokerConn {
  const ws = new PartySocket({ host: PARTY_HOST, room: room.toLowerCase() })
  h.onStatus('connecting')
  let closed = false
  let beat: ReturnType<typeof setInterval> | null = null
  ws.addEventListener('open', () => {
    h.onStatus('open')
    ws.send(JSON.stringify({ t: 'join', id, name, game: 'holdem', ...(create ? { create: true, pcfg: create } : {}), ...(getToken() ? { token: getToken() } : {}) }))
    if (beat) clearInterval(beat)
    beat = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping', ts: Date.now() })) }, 15000)
  })
  ws.addEventListener('close', () => { if (!closed) h.onStatus('closed') })
  ws.addEventListener('message', (e) => {
    if (closed) return
    const m = JSON.parse(e.data as string) as PokerServerMsg | { t: 'error'; message: string } | { t: 'pong' }
    if (m.t === 'pview') h.onView(m.view)
    else if (m.t === 'error') h.onError(m.message)
  })
  const wake = () => { if (!closed && document.visibilityState === 'visible' && ws.readyState !== 1) ws.reconnect() }
  document.addEventListener('visibilitychange', wake)
  return {
    send: (m) => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'p', m })) },
    close: () => { closed = true; if (beat) clearInterval(beat); document.removeEventListener('visibilitychange', wake); try { ws.send(JSON.stringify({ t: 'bye' })) } catch { /* ignore */ } ws.close() },
  }
}
export type { PokerView }
