import type { Decision, TurnAction } from '../engine/game'
import type { RoomConfig, TableView } from '../engine/table'

export type ClientMsg =
  | { t: 'join'; id: string; name: string }
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
  | { t: 'ping'; ts: number }
export type ServerMsg = { t: 'view'; view: TableView } | { t: 'error'; message: string } | { t: 'pong'; ts: number }
