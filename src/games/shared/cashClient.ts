import PartySocket from 'partysocket'
import { PARTY_HOST } from '../mahjong/net/client'
import { getToken } from '../../account/api'

export type Status = 'connecting' | 'open' | 'closed'
export type CashGameName = 'holdem' | 'blackjack' | 'bigtwo'
export interface TalkMsg { n: number; name: string; text: string }
export interface CashHandlers<V> { onView(v: V): void; onStatus(s: Status): void; onError(m: string): void; onTalk?(m: TalkMsg): void; onTalkLog?(m: TalkMsg[]): void }
export interface CashConn<M> { send(m: M): void; close(): void; say?(text: string): void }
export interface CashCreate { sb?: number; bb: number; casual: boolean }

export function getClientId(): string {
  try {
    let id = localStorage.getItem('kiiro-id')
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('kiiro-id', id) }
    return id
  } catch { return Math.random().toString(36).slice(2) }
}

/** Connects to a chip-table room (same socket and room-code space as every other game: the first player to create a code decides its game). */
export function connectCash<V, M>(game: CashGameName, room: string, id: string, name: string, h: CashHandlers<V>, create?: CashCreate): CashConn<M> {
  const ws = new PartySocket({ host: PARTY_HOST, room: room.toLowerCase() })
  h.onStatus('connecting')
  let closed = false
  let beat: ReturnType<typeof setInterval> | null = null
  ws.addEventListener('open', () => {
    h.onStatus('open')
    ws.send(JSON.stringify({ t: 'join', id, name, game, ...(create ? { create: true, pcfg: create } : {}), ...(getToken() ? { token: getToken() } : {}) }))
    if (beat) clearInterval(beat)
    beat = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping', ts: Date.now() })) }, 15000)
  })
  ws.addEventListener('close', () => { if (!closed) h.onStatus('closed') })
  ws.addEventListener('message', (e) => {
    if (closed) return
    const m = JSON.parse(e.data as string) as { t: string; view?: V; message?: string; msg?: TalkMsg; msgs?: TalkMsg[] }
    if (m.t === 'pview') h.onView(m.view as V)
    else if (m.t === 'talk' && m.msg) h.onTalk?.(m.msg)
    else if (m.t === 'talklog' && m.msgs) h.onTalkLog?.(m.msgs)
    else if (m.t === 'error') h.onError(m.message ?? 'error')
  })
  const wake = () => { if (!closed && document.visibilityState === 'visible' && ws.readyState !== 1) ws.reconnect() }
  document.addEventListener('visibilitychange', wake)
  return {
    send: (m) => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'p', m })) },
    say: (text) => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'talk', text })) },
    close: () => { closed = true; if (beat) clearInterval(beat); document.removeEventListener('visibilitychange', wake); try { ws.send(JSON.stringify({ t: 'bye' })) } catch { /* ignore */ } ws.close() },
  }
}
