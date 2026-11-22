import type { BtConfig, BtView } from '../engine/table'

export type BtMsg =
  | { k: 'start' }
  | { k: 'play'; cards: number[] }
  | { k: 'pass' }
  | { k: 'lobby' }
  | { k: 'config'; config: Partial<BtConfig> }
export type BigTwoView = BtView & { signedIn: boolean }
