import { BlackjackTable } from '../blackjack/engine/table'
import { BigTwoTable } from '../bigtwo/engine/table'
import { PokerTable } from '../holdem/engine/table'
import { botDecision, personaFor } from '../holdem/engine/bot'
import type { HoldemView } from '../holdem/net/client'
import type { PokerMsg } from '../holdem/net/protocol'
import type { BjMsg, BlackjackView } from '../blackjack/net/protocol'
import type { BigTwoView, BtMsg } from '../bigtwo/net/protocol'
import type { CashConn, CashHandlers } from './cashClient'

/** Offline practice: the same engines run inside the browser, with no server, no account and no chips. */
export function connectLocalBlackjack(id: string, name: string, minBet: number, h: CashHandlers<BlackjackView>): CashConn<BjMsg> {
  const t = new BlackjackTable({ bet: minBet, casual: true, maxSeats: 6 })
  const push = () => h.onView({ ...t.view(id), signedIn: false, balance: null })
  t.onChange(push)
  t.join(id)
  t.sit(id, name, t.casualStack)
  h.onStatus('open')
  push()
  return {
    send(m) {
      if (m.k === 'act') {
        const e = t.act(id, m.a)
        if (e) h.onError(e)
      } else if (m.k === 'out') t.setOut(id, m.out)
    },
    close() {
      t.dispose()
    },
  }
}

export function connectLocalBigTwo(id: string, name: string, h: CashHandlers<BigTwoView>): CashConn<BtMsg> {
  const t = new BigTwoTable()
  const push = () => h.onView({ ...t.view(id), signedIn: false, watching: 0 })
  t.onChange(push)
  t.join(id, name)
  t.start(id) // practice starts at once: three bots take the other seats
  h.onStatus('open')
  push()
  return {
    send(m) {
      if (m.k === 'play') {
        const e = t.play(id, m.cards)
        if (e) h.onError(e)
      } else if (m.k === 'pass') {
        const e = t.pass(id)
        if (e) h.onError(e)
      } else if (m.k === 'lobby') {
        t.backToLobby(id)
        t.start(id)
      } // "play again" deals a new game straight away
    },
    close() {
      t.dispose()
    },
  }
}

/** Offline Hold'em: the real table engine in the browser, you and three bots. Free practice stacks, nothing is saved. */
export function connectLocalHoldem(id: string, name: string, h: CashHandlers<HoldemView>): CashConn<PokerMsg> {
  const t = new PokerTable({ sb: 25, bb: 50, casual: true, maxSeats: 6 })
  t.resultMs = 3500
  const bots = ['bot-1', 'bot-2', 'bot-3']
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let planned = ''
  const push = () => h.onView({ ...t.view(id), signedIn: false, balance: null })
  const botTurn = () => {
    if (t.toAct < 0 || t.street === 'wait' || t.street === 'showdown') return
    const botId = t.seats[t.toAct]?.id
    if (!botId || !bots.includes(botId)) return
    const key = `${t.handNo}:${t.street}:${t.toAct}`
    if (key === planned) return // already thinking about this decision
    planned = key
    // decide now (nothing changes while it is this bot's turn), then think for as long as a person would: quick folds and checks, a longer tank before a big raise
    const first = t.view(botId)
    if (!first.turn) return
    const plan = botDecision(first, Math.random, personaFor(botId))
    const think =
      plan.a === 'fold' || plan.a === 'check' ? 650 + Math.random() * 800 : plan.a === 'call' ? 900 + Math.random() * 900 : 1300 + Math.random() * 1900
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (t.seats[t.toAct]?.id !== botId) return
      const v = t.view(botId)
      if (!v.turn) return
      const err = t.act(botId, plan)
      if (err) t.act(botId, v.turn.canCheck ? { a: 'check' } : { a: 'fold' }) // never get stuck on a rejected move
    }, think)
    timers.add(timer)
  }
  t.onChange(() => {
    push()
    botTurn()
  })
  t.autostart = false // seat everyone first, then deal
  t.join(id)
  t.sit(id, name, t.casualStack)
  bots.forEach((b, i) => {
    t.join(b)
    t.sit(b, `Bot ${i + 1}`, t.casualStack)
  })
  t.autostart = true
  h.onStatus('open')
  push()
  t.drive()
  return {
    send(m) {
      if (m.k === 'act') {
        const e = t.act(id, m.a)
        if (e) h.onError(e)
      } else if (m.k === 'out') t.setOut(id, m.out)
    },
    close() {
      for (const x of timers) clearTimeout(x)
      timers.clear()
      t.dispose()
    },
  }
}
