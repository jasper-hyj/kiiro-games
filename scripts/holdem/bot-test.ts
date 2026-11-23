// Run: npx tsx scripts/holdem/bot-test.ts   Four practice bots play many hands at a casual table: no illegal action, chips conserved, sensible behaviour.
import { PokerTable } from '../../src/games/holdem/engine/table'
import { botDecision, preflopStrength } from '../../src/games/holdem/engine/bot'

let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }

// --- the strength estimate puts hands in a sensible order
ok(preflopStrength([12 * 1 + 0 + 39 - 39, 12 + 13]) >= 0, 'strength is computed')
const card = (rank: number, suit: number) => suit * 13 + rank // 0 = two ... 12 = ace
ok(preflopStrength([card(12, 0), card(12, 1)]) > 0.95, 'a pair of aces is nearly the best hand')
ok(preflopStrength([card(12, 0), card(11, 0)]) > preflopStrength([card(12, 0), card(11, 1)]), 'suited beats offsuit')
ok(preflopStrength([card(5, 0), card(5, 1)]) > preflopStrength([card(12, 0), card(2, 1)]), 'a medium pair beats ace-four offsuit')
ok(preflopStrength([card(5, 0), card(0, 1)]) < 0.25, 'seven-two offsuit-like trash is weak')

// --- a table of bots playing real hands
const t = new PokerTable({ sb: 25, bb: 50, casual: true, maxSeats: 6 })
t.resultMs = 5
t.turnTimerMs = 60000
const ids = ['b1', 'b2', 'b3', 'b4']
const seatOf: Record<string, number> = {}
for (const id of ids) { t.join(id); const r = t.sit(id, id, t.casualStack); if (r.ok) seatOf[id] = r.seat }
const counts = { fold: 0, check: 0, call: 0, raise: 0, allin: 0 }
let illegal = 0, hands = 0, acts = 0
const wins: Record<string, number> = { b1: 0, b2: 0, b3: 0, b4: 0 }
const total0 = ids.length * t.casualStack
let badSums = 0
const lastHand = { n: -1 }
const step = () => {
  if (t.toAct < 0 || t.street === 'wait' || t.street === 'showdown') return
  const id = t.seats[t.toAct].id!
  const v = t.view(id)
  if (!v.turn) return
  const a = botDecision(v)
  const err = t.act(id, a)
  acts++
  if (err) { illegal++; if (illegal < 4) console.log('illegal', id, JSON.stringify(a), err, JSON.stringify(v.turn)) }
  else counts[a.a]++
}
t.onChange(() => { if (t.handNo !== lastHand.n && t.street === 'showdown') { /* counted below */ } queueMicrotask(step) })
const target = Number(process.env.HANDS ?? 300)
const t0 = Date.now()
await new Promise<void>((resolve) => {
  const tick = setInterval(() => {
    if (t.result && t.handNo !== lastHand.n) {
      lastHand.n = t.handNo; hands++
      // at the end of every hand the chips on the table are the starting chips plus free refills of busted seats (whole stacks)
      const sum = t.seats.reduce((a, x) => a + (x.id ? x.stack : 0), 0)
      if (sum < total0 || (sum - total0) % t.casualStack !== 0) badSums++
 t.result.won.forEach((w, i) => { if (w > 0) wins[t.seats[i].id ?? ''] = (wins[t.seats[i].id ?? ''] ?? 0) + 1 }) }
    if (hands >= target || Date.now() - t0 > 120000) { clearInterval(tick); resolve() }
  }, 4)
})
t.dispose()
ok(hands >= Math.min(target, 150), `${hands} hands were played to a result`)
ok(illegal === 0, `the bots never made an illegal action (${illegal} of ${acts})`)
ok(badSums === 0, `after every hand the chips add up (${badSums} hands off; busted bots are refilled with a whole free stack)`)
const mix = Object.entries(counts).map(([k, n]) => `${k} ${Math.round((n / Math.max(1, acts)) * 100)}%`).join(', ')
console.log('action mix:', mix)
ok(counts.fold > acts * 0.08 && counts.fold < acts * 0.65, 'they fold sometimes but not always')
ok(counts.raise + counts.allin > acts * 0.03, 'they bet and raise')
ok(counts.call + counts.check > acts * 0.25, 'they call and check a fair amount')
const winRates = Object.values(wins).map((w) => w / Math.max(1, hands))
ok(Math.max(...winRates) < 0.45 && Math.min(...winRates) > 0.1, `no seat dominates (${winRates.map((x) => Math.round(x * 100) + '%').join(', ')})`)
void seatOf
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
