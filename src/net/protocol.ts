import type { Decision, TurnAction } from '../engine/game'
import type { RoomConfig, TableView } from '../engine/table'

export type ClientMsg =
  | { t: 'join'; id: string; name: string }
  | { t: 'config'; config: Partial<RoomConfig> }
  | { t: 'start' }
  | { t: 'act'; a: TurnAction }
  | { t: 'decide'; d: Decision }
  | { t: 'ack' }
  | { t: 'lobby' }
export type ServerMsg = { t: 'view'; view: TableView } | { t: 'error'; message: string }
