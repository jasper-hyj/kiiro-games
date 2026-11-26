/**
 * Every page address in one place.
 *
 *   /                      hub (pick a game, enter a room code)
 *   /room                  create a room or enter a code
 *   /room/new              make a new room right away (?game=holdem preselects the game, ?rule=riichi for Mahjong)
 *   /room/1234             a room: the invite link
 *   /<game>/1234           that room's table (?watch=1 to only watch)        game = mahjong | holdem | blackjack | bigtwo
 *   /<game>/practice       play against bots in the browser
 *   /<game>/local          two people on one device (games without hidden information)
 *   /mahjong/tutorial      the guided Mahjong game
 *   /admin  /admin/users   admin (tab in the path)
 *
 * Older links (/holdem?room=1234&from=room&make=1&cfg=..., /?solo=1, /room?create=1&pick=...) are rewritten to these by `legacyTarget()`.
 */
import { GAMES, playsOnOneDevice, type GameKey } from './games/catalog'
export { GAMES, type GameKey }
export const MAHJONG_PATH = '/mahjong'
export const HOLDEM_PATH = '/holdem'
export const BLACKJACK_PATH = '/blackjack'
export const BIGTWO_PATH = '/bigtwo'
export const isGame = (s: string | null | undefined): s is GameKey => !!s && (GAMES as readonly string[]).includes(s)
const isCode = (s: string | null | undefined): s is string => !!s && /^\d{4}$/.test(s)

export type Route =
  | { page: 'hub' }
  | { page: 'room'; code: string | null; fresh: boolean; game: GameKey | null }
  | { page: 'table'; game: GameKey; code: string; watch: boolean }
  | { page: 'practice'; game: GameKey; tutorial: boolean; local?: boolean }
  | { page: 'gameStart'; game: GameKey } // /<game> with nothing else: go to a new room for it
  | { page: 'admin'; tab: string }
  | { page: 'tiles' } // the Mahjong tile gallery (dev)

export const tableUrl = (game: GameKey, code: string, watch = false) => `/${game}/${code}${watch ? '?watch=1' : ''}`
export const roomUrl = (code?: string) => (code ? `/room/${code}` : '/room')
export const newRoomUrl = (game?: GameKey, rule?: string) => `/room/new${game ? `?game=${game}${rule ? `&rule=${rule}` : ''}` : ''}`
export const localUrl = (game: GameKey) => `/${game}/local`
export const practiceUrl = (game: GameKey) => `/${game}/practice`

/** Where the current address means something else in the old scheme (null if it is already a current address). */
export function legacyTarget(loc: Pick<Location, 'pathname' | 'search'> = location): string | null {
  const parts = loc.pathname.split('/').filter(Boolean)
  const q = new URLSearchParams(loc.search)
  const first = parts[0],
    second = parts[1]
  const code = q.get('room')
  if (parts.length === 0) {
    if (isCode(code)) return roomUrl(code) // "/?room=1234"
    if (q.has('solo') || q.has('tutorial') || q.has('tiles') || q.has('stress') || q.has('debug')) return `/mahjong/practice${loc.search}`
    return null
  }
  if (first === 'room' && parts.length === 1) {
    if (isCode(code)) return roomUrl(code)
    if (q.get('create') === '1') return newRoomUrl(isGame(q.get('pick')) ? (q.get('pick') as GameKey) : undefined, q.get('rule') ?? undefined)
    return null
  }
  if (isGame(first) && parts.length === 1) {
    if (isCode(code)) return tableUrl(first, code, q.get('watch') === '1')
    if (q.get('practice') === '1') return practiceUrl(first)
    if (first === 'mahjong') {
      if (q.get('tutorial') === '1') return '/mahjong/tutorial'
      if (q.has('solo') || q.has('stress') || q.has('debug') || q.has('tiles') || q.has('rule') || q.has('players')) return `/mahjong/practice${loc.search}`
    }
    return null
  }
  void second
  return null
}

let cached: Route | null = null
export function route(): Route {
  if (cached) return cached
  const parts = location.pathname.split('/').filter(Boolean)
  const q = new URLSearchParams(location.search)
  const [first, second] = parts
  let r: Route = { page: 'hub' }
  if (first === 'admin') r = { page: 'admin', tab: second ?? 'overview' }
  else if (first === 'room')
    r = isCode(second)
      ? { page: 'room', code: second, fresh: false, game: null }
      : second === 'new'
        ? { page: 'room', code: null, fresh: true, game: isGame(q.get('game')) ? (q.get('game') as GameKey) : null }
        : { page: 'room', code: null, fresh: false, game: null }
  else if (isGame(first)) {
    if (isCode(second)) r = { page: 'table', game: first, code: second, watch: q.get('watch') === '1' }
    else if (second === 'practice' || second === 'tutorial')
      r = q.has('tiles') ? { page: 'tiles' } : { page: 'practice', game: first, tutorial: second === 'tutorial' }
    else if (second === 'local' && playsOnOneDevice(first)) r = { page: 'practice', game: first, tutorial: false, local: true }
    else r = { page: 'gameStart', game: first }
  }
  cached = r
  return r
}
