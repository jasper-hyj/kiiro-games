import { liveSocket } from '../../net/live'
import { PARTY_HOST } from '../mahjong/net/client'
import { getToken } from '../../account/api'
import { ENGINES } from './registry'
import { allowsUndo } from '../catalog'
import type { TurnGame } from './base'
import type { PlayView } from './base'

/** `local`: two people share this device, so the board keeps one orientation and nobody is marked "you" */
export type PlayViewX = PlayView & { signedIn: boolean; watching: number; local?: boolean; canUndo?: boolean }
export type TalkMsg = { n: number; name: string; text: string }
export interface PlayHandlers {
  onView(v: PlayViewX): void
  onStatus(s: 'connecting' | 'open' | 'closed'): void
  onError(m: string): void
  onTalk?(m: TalkMsg): void
  onTalkLog?(m: TalkMsg[]): void
}
export interface PlayConn {
  send(m: Record<string, unknown>): void
  say?(text: string): void
  /** take back the last move (practice and same-device board games only) */
  undo?(): void
  close(): void
}

/** A table on the server (party "play"): the room that made it already chose the game, its rules and its host. */
export function connectPlay(kind: string, room: string, id: string, name: string, h: PlayHandlers, opts?: { watch?: boolean }): PlayConn {
  const live = liveSocket({
    host: PARTY_HOST,
    party: 'play',
    room: room.toLowerCase(),
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
export function connectLocalPlay(
  kind: string,
  id: string,
  name: string,
  h: PlayHandlers,
  config: Record<string, unknown> = {},
  opts: { local?: boolean } = {},
): PlayConn {
  if (opts.local) return connectSameDevice(kind, h, config)
  const g = ENGINES[kind]()
  g.turnTimerMs = 0
  g.join(id, name)
  g.setConfig(id, { ...g.config, ...config, ranked: false })
  const history = undoStack(kind, g)
  const push = () => h.onView({ ...g.view(id), signedIn: false, watching: 0, canUndo: history.can() })
  g.onChange(push)
  h.onStatus('open')
  g.start(id)
  push()
  return {
    send(m) {
      const e = history.send(id, m)
      if (e) h.onError(e)
    },
    undo: () => history.undo(),
    close() {
      g.dispose()
    },
  }
}

/**
 * Two people on one device: both seats are people. The board never turns round (the players usually sit facing each other); nothing is hidden
 * in these games. Messages that are moves go to the seat on turn, everything else to the host.
 */
function connectSameDevice(kind: string, h: PlayHandlers, config: Record<string, unknown>): PlayConn {
  const g = ENGINES[kind]()
  g.turnTimerMs = 0
  const host = 'p1',
    second = 'p2'
  g.join(host, 'Player 1')
  g.join(second, 'Player 2')
  g.setConfig(host, { ...g.config, ...config, ranked: false })
  const viewer = () => (g.status === 'playing' && g.turn() >= 0 ? (g.seats[g.turn()].id ?? host) : host)
  const history = undoStack(kind, g)
  const push = () => {
    const v = g.view(viewer())
    h.onView({ ...v, seats: v.seats.map((s) => ({ ...s, me: false })), local: true, signedIn: false, watching: 0, canUndo: history.can() })
  }
  g.onChange(push)
  h.onStatus('open')
  g.start(host)
  push()
  return {
    send(m) {
      const e = history.send(m.k === 'act' ? viewer() : host, m)
      if (e) h.onError(e)
    },
    undo: () => history.undo(),
    close() {
      g.dispose()
    },
  }
}

/**
 * Remembers the table before each move a person makes, so it can be taken back. In practice that also takes back the computer's reply.
 * Only for games without chance or hidden hands (see the catalog).
 */
function undoStack(kind: string, g: TurnGame) {
  const before: string[] = []
  const enabled = allowsUndo(kind)
  return {
    can: () => before.length > 0,
    send(id: string, m: Record<string, unknown>): string | null {
      if (m.k !== 'act') {
        before.length = 0 // a new game starts a new history
        return g.message(id, m)
      }
      if (!enabled) return g.message(id, m)
      // pushed first, so the view sent out by the move already offers to take it back
      before.push(g.serialize())
      if (before.length > 400) before.shift()
      const error = g.message(id, m)
      if (error) before.pop()
      return error
    },
    undo() {
      const state = before.pop()
      if (state) g.rewind(state)
    },
  }
}
