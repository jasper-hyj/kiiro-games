/** The ids of the games that run on the shared turn-based frame (engine: registry.ts, screens: ui.tsx). Add a new game's id here first. */
export const GENERIC_GAMES = [
  'gomoku',
  'crazyeights',
  'yahtzee',
  'liarsdice',
  'chess',
  'xiangqi',
  'doudizhu',
  'bridge',
  'chinesecheckers',
  'go',
  'hearts',
  'spades',
  'checkers',
  'reversi',
] as const
export type GenericGame = (typeof GENERIC_GAMES)[number]
