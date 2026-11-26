import type { BjAct, BjView } from '../engine/table'

export type BjMsg = { k: 'sit'; buyin: number } | { k: 'act'; a: BjAct } | { k: 'rebuy'; amount: number } | { k: 'stand' } | { k: 'out'; out: boolean }
export type BlackjackView = BjView & { signedIn: boolean; balance: number | null }
