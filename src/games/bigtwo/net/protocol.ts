import type { BtConfig, BtView } from '../engine/table'

export type BtMsg =
  | { k: 'start' }
  | { k: 'play'; cards: number[] }
  | { k: 'pass' }
  | { k: 'lobby' }
  | { k: 'sit' } // an observer takes a free seat
  | { k: 'config'; config: Partial<BtConfig> }
export type BigTwoView = BtView & { signedIn: boolean; /** people watching without a seat */ watching: number }
