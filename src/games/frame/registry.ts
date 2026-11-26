import type { TurnGame, GameMeta } from './base'
import { Gomoku, GOMOKU_META } from '../gomoku/engine'
import { CrazyEights, C8_META } from '../crazyeights/engine'
import { Yahtzee, YAHTZEE_META } from '../yahtzee/engine'
import { LiarsDice, LIARS_META } from '../liarsdice/engine'
import { Chess, CHESS_META } from '../chess/engine'
import { Xiangqi, XQ_META } from '../xiangqi/engine'
import { DouDizhu, DD_META } from '../doudizhu/engine'
import { Bridge, BRIDGE_META } from '../bridge/engine'
import { ChineseCheckers, CC_META } from '../chinesecheckers/engine'
import { Go, GO_META } from '../go/engine'
import { Hearts, HEARTS_META } from '../hearts/engine'
import { Spades, SPADES_META } from '../spades/engine'
import { Checkers, CHECKERS_META } from '../checkers/engine'
import { Reversi, REVERSI_META } from '../reversi/engine'

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
  chinesecheckers: () => new ChineseCheckers().init(),
  go: () => new Go().init(),
  hearts: () => new Hearts().init(),
  spades: () => new Spades().init(),
  checkers: () => new Checkers().init(),
  reversi: () => new Reversi().init(),
}
export const METAS: Record<string, GameMeta> = {
  gomoku: GOMOKU_META,
  crazyeights: C8_META,
  yahtzee: YAHTZEE_META,
  liarsdice: LIARS_META,
  chess: CHESS_META,
  xiangqi: XQ_META,
  doudizhu: DD_META,
  bridge: BRIDGE_META,
  chinesecheckers: CC_META,
  go: GO_META,
  hearts: HEARTS_META,
  spades: SPADES_META,
  checkers: CHECKERS_META,
  reversi: REVERSI_META,
}
export const isGeneric = (k: string) => k in ENGINES
