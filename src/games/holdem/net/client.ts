import { connectCash, getClientId, type CashHandlers, type CashConn, type Status } from '../../shared/cashClient'
import type { PokerMsg, PokerServerMsg } from './protocol'

export type HoldemView = PokerServerMsg['view']
export type { Status }
export type Handlers = CashHandlers<HoldemView>
export type PokerConn = CashConn<PokerMsg>
export { getClientId }

export function connectHoldem(room: string, id: string, name: string, h: Handlers, create?: { sb: number; bb: number; casual: boolean }): PokerConn {
  return connectCash<HoldemView, PokerMsg>('holdem', room, id, name, h, create)
}
