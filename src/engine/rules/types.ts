import type { Counts, SetInfo } from '../hand'

export type RuleId = 'riichi' | 'hk' | 'taiwan' | 'mcr' | 'sichuan'

export interface MeldInfo { type: 'chi' | 'pon' | 'minkan' | 'ankan' | 'kakan'; tiles: number[]; from: number }

export interface WinContext {
  counts: Counts            // concealed tiles incl. the winning tile (kinds)
  melds: MeldInfo[]         // called / declared melds
  allKinds: Counts          // concealed + melds
  allIds: number[]          // every tile id in hand + melds (incl. win tile)
  winKind: number
  tsumo: boolean
  seatWind: number          // 0..3 (E S W N) => kinds 27..30
  roundWind: number
  dealer: boolean
  flowers: number[]         // flower kinds
  riichi: boolean
  doubleRiichi: boolean
  ippatsu: boolean
  lastTile: boolean         // haitei / houtei
  rinshan: boolean
  chankan: boolean
  firstTurn: boolean        // tenhou / chiihou
  dora: number; ura: number; aka: number; nuki: number
  lianZhuang: number
  voidSuit?: number | null  // Sichuan: the suit this player gave up (a hand holding it cannot win)
  waitCount: number         // distinct winning tiles before the win (single-wait detection)
  options: GameOptions
}

export interface GameOptions { aka: boolean; rounds: 1 | 2 | 4; minFan: number; players?: 3 | 4; botLevel?: 'easy' | 'normal' | 'hard'; swap?: boolean; cap?: number }

export interface YakuItem { name: string; zh?: string; value: number; yakuman?: boolean }
export interface HandScore {
  yaku: YakuItem[]
  total: number            // han (riichi) / fan (hk) / tai (taiwan)
  fu?: number
  base: number             // base points used by settle
  label?: string           // mangan etc.
  yakuman?: number
}

export interface SettleInfo { winner: number; from: number | null; dealer: number; honba: number; lianZhuang: number; n?: number }

export interface RuleSet {
  id: RuleId
  name: string
  zh: string
  blurb: string
  handSize: 13 | 16
  nSets: 4 | 5
  flowers: boolean
  deadWall: number
  startPoints: number
  unit: string
  specials: { chiitoi?: boolean; kokushi?: boolean }
  evaluate(ctx: WinContext): HandScore | null
  settle(score: HandScore, info: SettleInfo): number[]
  sanma?: boolean
}

export type Interp = { sets: SetInfo[]; pair: number; waitKind: 'ryanmen' | 'kanchan' | 'penchan' | 'shanpon' | 'tanki'; winSet: number /* -1 => pair */ }
