import type { TurnGame, GameMeta } from './base'
import { Gomoku, GOMOKU_META } from './gomoku'

/** The turn-based games that run on the shared frame (see base.ts). The server and the browser (practice mode) both build them from here. */
export const ENGINES: Record<string, () => TurnGame> = {
  gomoku: () => new Gomoku().init(),
}
export const METAS: Record<string, GameMeta> = { gomoku: GOMOKU_META }
export const GENERIC_KINDS = Object.keys(ENGINES)
export const isGeneric = (k: string) => k in ENGINES
