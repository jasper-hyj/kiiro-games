import type { TurnGame, GameMeta } from './base'
import { Gomoku, GOMOKU_META } from './gomoku'
import { CrazyEights, C8_META } from './crazyeights'
import { Yahtzee, YAHTZEE_META } from './yahtzee'
import { LiarsDice, LIARS_META } from './liarsdice'
import { Chess, CHESS_META } from './chess'
import { Xiangqi, XQ_META } from './xiangqi'
import { DouDizhu, DD_META } from './doudizhu'
import { Bridge, BRIDGE_META } from './bridge'

/** The turn-based games that run on the shared frame (see base.ts). The server and the browser (practice mode) both build them from here. */
export const ENGINES: Record<string, () => TurnGame> = {
  gomoku: () => new Gomoku().init(),
  crazyeights: () => new CrazyEights().init(),
  yahtzee: () => new Yahtzee().init(),
  liarsdice: () => new LiarsDice().init(),
  chess: () => new Chess().init(),
  xiangqi: () => new Xiangqi().init(),
  doudizhu: () => new DouDizhu().init(),
  bridge: () => new Bridge().init(),
}
export const METAS: Record<string, GameMeta> = { gomoku: GOMOKU_META, crazyeights: C8_META, yahtzee: YAHTZEE_META, liarsdice: LIARS_META, chess: CHESS_META, xiangqi: XQ_META, doudizhu: DD_META, bridge: BRIDGE_META }
export const GENERIC_KINDS = Object.keys(ENGINES)
export const isGeneric = (k: string) => k in ENGINES
