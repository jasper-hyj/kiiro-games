import type { PokerAct, PokerConfig, PokerView } from '../engine/table'

/** Messages for a Hold'em room (they travel inside the same socket as Mahjong's, wrapped as {t:'p', m}). */
export type PokerMsg =
  { k: 'sit'; buyin: number } | { k: 'act'; a: PokerAct | unknown } | { k: 'rebuy'; amount: number } | { k: 'stand' } | { k: 'out'; out: boolean }
export type PokerServerMsg = { t: 'pview'; view: PokerView & { signedIn: boolean; balance: number | null } }
export type { PokerConfig }
