import { BlackjackTable } from '../blackjack/engine/table'
import { BigTwoTable } from '../bigtwo/engine/table'
import type { BjMsg, BlackjackView } from '../blackjack/net/protocol'
import type { BigTwoView, BtMsg } from '../bigtwo/net/protocol'
import type { CashConn, CashHandlers } from './cashClient'

/** Offline practice: the same engines run inside the browser, with no server, no account and no chips. */
export function connectLocalBlackjack(id: string, name: string, minBet: number, h: CashHandlers<BlackjackView>): CashConn<BjMsg> {
  const t = new BlackjackTable({ bet: minBet, casual: true, maxSeats: 6 })
  const push = () => h.onView({ ...t.view(id), signedIn: false, balance: null })
  t.onChange(push)
  t.join(id); t.sit(id, name, t.casualStack)
  h.onStatus('open'); push()
  return {
    send(m) {
      if (m.k === 'act') { const e = t.act(id, m.a); if (e) h.onError(e) }
      else if (m.k === 'out') t.setOut(id, m.out)
    },
    close() { t.dispose() },
  }
}

export function connectLocalBigTwo(id: string, name: string, h: CashHandlers<BigTwoView>): CashConn<BtMsg> {
  const t = new BigTwoTable()
  const push = () => h.onView({ ...t.view(id), signedIn: false, watching: 0 })
  t.onChange(push)
  t.join(id, name)
  t.start(id) // practice starts at once: three bots take the other seats
  h.onStatus('open'); push()
  return {
    send(m) {
      if (m.k === 'play') { const e = t.play(id, m.cards); if (e) h.onError(e) }
      else if (m.k === 'pass') { const e = t.pass(id); if (e) h.onError(e) }
      else if (m.k === 'lobby') { t.backToLobby(id); t.start(id) } // "play again" deals a new game straight away
    },
    close() { t.dispose() },
  }
}
