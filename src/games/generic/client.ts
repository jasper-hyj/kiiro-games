import { liveSocket } from '../../net/live'
import { PARTY_HOST } from '../mahjong/net/client'
import { getToken } from '../../account/api'
import { ENGINES } from './registry'
import type { PlayView } from './base'

export type PlayViewX = PlayView & { signedIn: boolean; watching: number }
export type TalkMsg = { n: number; name: string; text: string }
export interface PlayHandlers { onView(v: PlayViewX): void; onStatus(s: 'connecting' | 'open' | 'closed'): void; onError(m: string): void; onTalk?(m: TalkMsg): void; onTalkLog?(m: TalkMsg[]): void }
export interface PlayConn { send(m: Record<string, unknown>): void; say?(text: string): void; close(): void }

/** A table on the server (party "play"): the room that made it already chose the game, its rules and its host. */
export function connectPlay(kind: string, room: string, id: string, name: string, h: PlayHandlers, opts?: { watch?: boolean }): PlayConn {
  const live = liveSocket({
    host: PARTY_HOST, party: 'play', room: room.toLowerCase(),
    onStatus: h.onStatus,
    onOpen: (send) => send({ t: 'join', id, name, game: kind, ...(opts?.watch ? { watch: true } : {}), ...(getToken() ? { token: getToken() } : {}) }),
    onMessage: (m) => {
      if (m.t === 'pview') h.onView(m.view)
      else if (m.t === 'talk' && m.msg) h.onTalk?.(m.msg)
      else if (m.t === 'talklog' && m.msgs) h.onTalkLog?.(m.msgs)
      else if (m.t === 'error') h.onError(m.message ?? 'error')
    },
  })
  return { send: (m) => live.send({ t: 'p', m }), say: (text) => live.send({ t: 'talk', text }), close: () => live.close() }
}

/** Practice: the same engine runs in the browser, bots in every other seat, no server and no account. */
export function connectLocalPlay(kind: string, id: string, name: string, h: PlayHandlers, config: Record<string, unknown> = {}): PlayConn {
  const g = ENGINES[kind]()
  g.turnTimerMs = 0
  g.join(id, name)
  g.setConfig(id, { ...g.config, ...config, ranked: false })
  const push = () => h.onView({ ...g.view(id), signedIn: false, watching: 0 })
  g.onChange(push)
  h.onStatus('open')
  g.start(id)
  push()
  return {
    send(m) { const e = g.message(id, m); if (e) h.onError(e) },
    close() { g.dispose() },
  }
}
