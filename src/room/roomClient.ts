import { tableUrl } from '../route'
import { liveSocket } from '../net/live'
import { PARTY_HOST } from '../games/mahjong/net/client'
import { getToken } from '../account/api'

export type RoomGame = 'mahjong' | 'holdem' | 'blackjack' | 'bigtwo'
export type RoomCfg = Record<string, string | number | boolean>
export interface RoomMember { name: string; host: boolean; watching: boolean; signedIn: boolean; me: boolean }
export interface RoomView { you: string; host: boolean; game: RoomGame | null; cfg: RoomCfg; launched: boolean; members: RoomMember[] }
export interface RoomGo { game: RoomGame; cfg: RoomCfg; role: 'host' | 'play' | 'watch' }
export interface TalkLine { n: number; name: string; text: string }
export interface RoomHandlers {
  onView(v: RoomView): void
  onGo(g: RoomGo): void
  onStatus(s: 'connecting' | 'open' | 'closed'): void
  onError(m: string): void
  onTalk(m: TalkLine): void
  onTalkLog(m: TalkLine[]): void
}
export interface RoomConn { send(m: unknown): void; say(text: string): void; close(): void }

/** The room is its own server object (party "room"): the code only has to be unique among rooms. */
export function connectRoom(room: string, id: string, name: string, h: RoomHandlers, create = false): RoomConn {
  const live = liveSocket({
    host: PARTY_HOST, party: 'room', room: room.toLowerCase(),
    onStatus: h.onStatus,
    onOpen: (send) => send({ t: 'join', id, name, ...(create ? { create: true } : {}), ...(getToken() ? { token: getToken() } : {}) }),
    onMessage: (m) => {
      if (m.t === 'room') h.onView(m as RoomView)
      else if (m.t === 'go') h.onGo(m as RoomGo)
      else if (m.t === 'talk') h.onTalk(m.msg)
      else if (m.t === 'talklog') h.onTalkLog(m.msgs)
      else if (m.t === 'error') h.onError(m.message ?? 'error')
    },
  })
  return { send: (m) => live.send(m), say: (text) => live.send({ t: 'talk', text }), close: () => live.close() }
}

/** Where each person goes when the host starts: the table already exists (the room's server made it), so everyone just opens it. */
export function gameUrl(room: string, go: RoomGo): string {
  return tableUrl(go.game, room, go.role === 'watch')
}
