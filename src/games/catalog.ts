/**
 * The one list of every game on the site, in the order the hub shows them. The routes, the hub, the leaderboard and the economy all read it.
 *
 * To add a turn-based game:
 *   1. src/games/<id>/    engine.ts (rules + bot), Board.tsx (screen), strings.ts (text, with the name under the key <id>)
 *   2. add the id to frame/kinds.ts, the engine to frame/registry.ts and the screen to frame/boards.ts
 *   3. add the text to strings.ts, an entry here, an icon to icons.tsx and a page title to src/i18n.tsx
 *
 * This file is also used by the server, so it holds data only.
 */
export interface CatalogEntry {
  /** also the address: /<id>/practice, /<id>/<room code> */
  id: string
  /** string key of the game's name */
  name: string
  /** chips that one "normal" win is worth, so results compare across games on the overall leaderboard */
  unit: number
  /** two people can play on one device (nothing is hidden from either player) */
  local?: boolean
  /** moves can be taken back in practice and on one device (no chance, nothing hidden) */
  undo?: boolean
}

export const CATALOG = [
  { id: 'mahjong', name: 'hubMahjong', unit: 1000 },
  { id: 'holdem', name: 'hubHoldem', unit: 5000 },
  { id: 'blackjack', name: 'bjName', unit: 5000 },
  { id: 'bigtwo', name: 'btName', unit: 500 },
  { id: 'gomoku', name: 'gomoku', unit: 500, local: true, undo: true },
  { id: 'crazyeights', name: 'crazyeights', unit: 100 },
  { id: 'yahtzee', name: 'yahtzee', unit: 100, local: true },
  { id: 'liarsdice', name: 'liarsdice', unit: 400 },
  { id: 'chess', name: 'chess', unit: 500, local: true, undo: true },
  { id: 'xiangqi', name: 'xiangqi', unit: 500, local: true, undo: true },
  { id: 'doudizhu', name: 'doudizhu', unit: 600 },
  { id: 'bridge', name: 'bridge', unit: 200 },
  { id: 'hearts', name: 'hearts', unit: 400 },
  { id: 'spades', name: 'spades', unit: 400 },
  { id: 'go', name: 'go', unit: 500, local: true, undo: true },
  { id: 'checkers', name: 'checkers', unit: 500, local: true, undo: true },
  { id: 'reversi', name: 'reversi', unit: 400, local: true, undo: true },
  { id: 'chinesecheckers', name: 'chinesecheckers', unit: 300, local: true, undo: true },
] as const satisfies readonly CatalogEntry[]

export type GameKey = (typeof CATALOG)[number]['id']
export const GAMES: readonly GameKey[] = CATALOG.map((g) => g.id)
export const allowsUndo = (id: string) => CATALOG.some((g) => g.id === id && 'undo' in g)
export const playsOnOneDevice = (id: string) => CATALOG.some((g) => g.id === id && 'local' in g)
