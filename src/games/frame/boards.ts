import type { GenericGame } from './kinds'
import type { GameUI } from './types'
import './strings'
import './frame.css'
import { GomokuBoard } from '../gomoku/Board'
import { CrazyBoard } from '../crazyeights/Board'
import { YahtzeeBoard } from '../yahtzee/Board'
import { LiarsBoard } from '../liarsdice/Board'
import { ChessBoard } from '../chess/Board'
import { XiangqiBoard } from '../xiangqi/Board'
import { DouBoard } from '../doudizhu/Board'
import { BridgeBoard } from '../bridge/Board'
import { ReversiBoard } from '../reversi/Board'
import { CheckersBoard } from '../checkers/Board'
import { GoBoard } from '../go/Board'
import { ChineseCheckersBoard } from '../chinesecheckers/Board'
import { HeartsBoard } from '../hearts/Board'
import { SpadesBoard } from '../spades/Board'
// after every game's own styles: the small-phone sizing
import './phone.css'

/** Every turn-based game's screen. A new game is added here, in registry.ts (rules) and in kinds.ts (its id). */
export const GAME_UI: Record<GenericGame, GameUI> = {
  reversi: {
    name: 'reversi',
    blurb: 'reversiBlurb',
    settings: (c, t) => [t(c.level === 'easy' ? 'chEasy' : c.level === 'hard' ? 'chHard' : 'chNormal')],
    help: { title: 'rvHow', lines: ['rvR1', 'rvR2', 'rvR3', 'rvR4'] },
    Board: ReversiBoard,
  },
  checkers: {
    name: 'checkers',
    blurb: 'checkersBlurb',
    settings: (c, t) => [t(c.level === 'easy' ? 'chEasy' : c.level === 'hard' ? 'chHard' : 'chNormal')],
    help: { title: 'ckHow', lines: ['ckR1', 'ckR2', 'ckR3', 'ckR4'] },
    Board: CheckersBoard,
  },
  go: {
    name: 'go',
    blurb: 'goBlurb',
    settings: (c) => [`${c.size} × ${c.size}`],
    help: { title: 'goHow', lines: ['goR1', 'goR2', 'goR3', 'goR4'] },
    Board: GoBoard,
  },
  chinesecheckers: {
    name: 'chinesecheckers',
    blurb: 'chinesecheckersBlurb',
    settings: (c) => [`${c.players}`],
    help: { title: 'ccHow', lines: ['ccR1', 'ccR2', 'ccR3', 'ccR4'] },
    Board: ChineseCheckersBoard,
  },
  hearts: { name: 'hearts', blurb: 'heartsBlurb', settings: () => [], help: { title: 'htHow', lines: ['htR1', 'htR2', 'htR3', 'htR4'] }, Board: HeartsBoard },
  spades: { name: 'spades', blurb: 'spadesBlurb', settings: () => [], help: { title: 'spHow', lines: ['spR1', 'spR2', 'spR3', 'spR4'] }, Board: SpadesBoard },
  bridge: {
    name: 'bridge',
    blurb: 'bridgeBlurb',
    settings: () => [],
    help: { title: 'brHow', lines: ['brR1', 'brR2', 'brR3', 'brR4', 'brR5'] },
    Board: BridgeBoard,
  },
  doudizhu: {
    name: 'doudizhu',
    blurb: 'doudizhuBlurb',
    settings: () => [],
    help: { title: 'ddHow', lines: ['ddR1', 'ddR2', 'ddR3', 'ddR4', 'ddR5'] },
    Board: DouBoard,
  },
  xiangqi: {
    name: 'xiangqi',
    blurb: 'xiangqiBlurb',
    settings: (c, t) => [t(c.level === 'easy' ? 'chEasy' : c.level === 'hard' ? 'chHard' : 'chNormal')],
    help: { title: 'xqHow', lines: ['xqR1', 'xqR2', 'xqR3', 'xqR4'] },
    Board: XiangqiBoard,
  },
  chess: {
    name: 'chess',
    blurb: 'chessBlurb',
    settings: (c, t) => [t(c.level === 'easy' ? 'chEasy' : c.level === 'hard' ? 'chHard' : 'chNormal')],
    help: { title: 'chHow', lines: ['chR1', 'chR2', 'chR3', 'chR4'] },
    Board: ChessBoard,
  },
  liarsdice: {
    name: 'liarsdice',
    blurb: 'liarsdiceBlurb',
    settings: (c, t) => [`${c.players}`, c.wild ? t('ldWildOn') : t('ldWildOff')],
    help: { title: 'ldHow', lines: ['ldR1', 'ldR2', 'ldR3', 'ldR4', 'ldR5'] },
    Board: LiarsBoard,
  },
  yahtzee: {
    name: 'yahtzee',
    blurb: 'yahtzeeBlurb',
    settings: (c) => [`${c.players}`],
    help: { title: 'yzHow', lines: ['yzR1', 'yzR2', 'yzR3', 'yzR4', 'yzR5'] },
    Board: YahtzeeBoard,
  },
  crazyeights: {
    name: 'crazyeights',
    blurb: 'crazyeightsBlurb',
    settings: (c, t) => [`${c.players}`, c.action ? t('c8Actions') : t('c8Classic')],
    help: { title: 'c8How', lines: ['c8R1', 'c8R2', 'c8R3', 'c8R4', 'c8R5'] },
    Board: CrazyBoard,
  },
  gomoku: {
    name: 'gomoku',
    blurb: 'gomokuBlurb',
    settings: (c) => [`${c.size} × ${c.size}`],
    help: { title: 'gmHow', lines: ['gmR1', 'gmR2', 'gmR3', 'gmR4'] },
    Board: GomokuBoard,
  },
}
/** the settings each game offers in the room (labels are string keys), taken from the engine's meta */
export { METAS } from './registry'
