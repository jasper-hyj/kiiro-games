import { liveSocket } from '../../net/live'
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
export function connectCash<V, M>(game: CashGameName, room: string, id: string, name: string, h: CashHandlers<V>, create?: CashCreate, opts?: { watch?: boolean }): CashConn<M> {
  const live = liveSocket({
    host: PARTY_HOST, room: room.toLowerCase(),
    onStatus: h.onStatus,
    onOpen: (send) => send({ t: 'join', id, name, game, ...(opts?.watch ? { watch: true } : {}), ...(create ? { create: true, pcfg: create } : {}), ...(getToken() ? { token: getToken() } : {}) }),
    onMessage: (m: { t: string; view?: V; message?: string; msg?: TalkMsg; msgs?: TalkMsg[] }) => {
      if (m.t === 'pview') h.onView(m.view as V)
      else if (m.t === 'talk' && m.msg) h.onTalk?.(m.msg)
      else if (m.t === 'talklog' && m.msgs) h.onTalkLog?.(m.msgs)
      else if (m.t === 'error') h.onError(m.message ?? 'error')
    },
  })
  return {
    send: (m) => live.send({ t: 'p', m }),
    say: (text) => live.send({ t: 'talk', text }),
    close: () => live.close(),
  }
}
