import type { Decision, TurnAction } from '../engine/game'
import type { RoomConfig, TableView } from '../engine/table'

export type ClientMsg =
  | { t: 'join'; id: string; name: string; create?: boolean; /** watch the room without taking a seat */ watch?: boolean; /** account session, if signed in */ token?: string; /** which game a new room is for (default mahjong); joining a room of another game is refused */ game?: 'mahjong' | 'holdem' | 'blackjack' | 'bigtwo'; /** Hold'em table settings for a new room */ pcfg?: { sb: number; bb: number; casual: boolean } }
  | { t: 'bye' }
  /** an observer takes a free seat */
  | { t: 'sit' }
  | { t: 'config'; config: Partial<RoomConfig> }
  | { t: 'start' }
  | { t: 'act'; a: TurnAction }
  | { t: 'decide'; d: Decision }
  | { t: 'swap'; tiles: number[] }
  | { t: 'void'; suit: number }
  | { t: 'ack' }
  | { t: 'lobby' }
  | { t: 'toggleBot'; seat: number }
  | { t: 'chat'; key: string }
  | { t: 'here' }
  | { t: 'say'; text: string }
  | { t: 'ping'; ts: number }
  | { t: 'p'; m: import('../../holdem/net/protocol').PokerMsg }
  /** free-text table chat for the card games */
  | { t: 'talk'; text: string }
export type ServerMsg = { t: 'view'; view: TableView } | { t: 'error'; message: string } | { t: 'pong'; ts: number }
  | { t: 'talk'; msg: { n: number; name: string; text: string } } | { t: 'talklog'; msgs: { n: number; name: string; text: string }[] }
