/** Where things live: the hub (game picker) at "/", Mahjong at "/mahjong". Old links such as "/?room=1234" or "/?solo=1" still open the game. */
export const MAHJONG_PATH = '/mahjong'
export const HOLDEM_PATH = '/holdem'
export const BLACKJACK_PATH = '/blackjack'
export const BIGTWO_PATH = '/bigtwo'
const GAME_PARAMS = ['room', 'solo', 'stress', 'tutorial', 'tiles', 'debug', 'rule', 'players']
export function isHub(): boolean {
  if (typeof location === 'undefined') return false
  const path = location.pathname.replace(/\/+$/, '') || '/'
  if (path !== '/') return false
  const q = new URLSearchParams(location.search)
  return !GAME_PARAMS.some((k) => q.has(k))
}

export function isAdminPage(): boolean { return typeof location !== 'undefined' && location.pathname.replace(/\/+$/, '') === '/admin' }
export function isHoldem(): boolean { return typeof location !== 'undefined' && location.pathname.replace(/\/+$/, '') === HOLDEM_PATH }
export function isBlackjack(): boolean { return typeof location !== 'undefined' && location.pathname.replace(/\/+$/, '') === BLACKJACK_PATH }
export function isBigTwo(): boolean { return typeof location !== 'undefined' && location.pathname.replace(/\/+$/, '') === BIGTWO_PATH }
