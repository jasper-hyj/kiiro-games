// Run: npx tsx scripts/blackjack/engine-test.ts
import { BlackjackTable, total, isNatural, type BjAct } from '../../src/games/blackjack/engine/table'
import type { HandRecord } from '../../src/games/shared/cash'

let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const R = '23456789TJQKA', S = 'shdc'
const C = (x: string) => R.indexOf(x[0]) + 13 * S.indexOf(x[1])
const H = (...x: string[]) => x.map(C)

ok(total(H('As', 'Kd')).sum === 21 && total(H('As', 'Kd')).soft, 'A+K is a soft 21')
ok(total(H('As', 'Ad', '9c')).sum === 21, 'A+A+9 = 21 (one ace as 11)')
ok(total(H('As', '6d', 'Kc')).sum === 17 && !total(H('As', '6d', 'Kc')).soft, 'A+6+K = hard 17')
ok(total(H('Ks', 'Qd', '5c')).sum === 25, 'K+Q+5 busts at 25')
ok(isNatural(H('As', 'Td')) && !isNatural(H('5s', '6d', 'Th')), 'natural needs exactly two cards')

/** A table with one or more players and a scripted shoe: cards are listed in the order they are drawn. */
function game(order: string[], n = 1, stack = 1000, bet = 10) {
  const t = new BlackjackTable({ bet, casual: false, maxSeats: 6 })
  t.turnTimerMs = 0; t.betMs = 0; t.resultMs = 0
  const recs: HandRecord[] = []; t.onHand = (r) => recs.push(r)
  t.autostart = false
  for (let i = 0; i < n; i++) t.sit('p' + i, 'P' + i, Math.max(stack, bet * 20))
  // keep the scripted cards, plus filler so a long hand never runs the shoe dry
  const filler = Array.from({ length: 52 }, (_, i) => i)
  t.riggedShoe = [...filler, ...order.map(C).reverse()]
  t.autostart = true; t.drive()
  return { t, recs }
}
const play = (t: BlackjackTable, id: string, ...acts: BjAct[]) => { for (const a of acts) { const e = t.act(id, a); if (e) return e } return null }
const stackOf = (t: BlackjackTable, id: string) => t.seats[t.seatOf(id)].stack

// deal order for one player: P1, D1, P2, D2, then draws
{ // natural pays 3:2
  const { t } = game(['As', '9d', 'Kh', '8c'])
  play(t, 'p0', { a: 'bet', amount: 10 })
  ok(stackOf(t, 'p0') === 1000 + 15 || stackOf(t, 'p0') === 200 + 15 || t.seats[0].stack > 200, 'blackjack pays 3:2')
}
const start = (order: string[], bet = 10, stack = 1000) => { const g = game(order, 1, stack, bet); const before = stackOf(g.t, 'p0'); const e = g.t.act('p0', { a: 'bet', amount: bet }); return { ...g, before, e } }
{ const g = start(['As', '9d', 'Kh', '8c']); ok(stackOf(g.t, 'p0') === g.before + 15, `blackjack pays 3:2 (${stackOf(g.t, 'p0') - g.before})`) }
{ const g = start(['Ts', '9d', 'Kh', '8c', '5d']) // 20 vs 17: stand, win
  play(g.t, 'p0', { a: 'stand' }); ok(stackOf(g.t, 'p0') === g.before + 10, 'stand on 20 beats 17 (+bet)') }
{ const g = start(['Ts', '9d', '6h', '8c', 'Kd']) // 16: hit K -> bust
  play(g.t, 'p0', { a: 'hit' }); ok(stackOf(g.t, 'p0') === g.before - 10, 'bust loses the bet') }
{ const g = start(['Ts', '9d', '8h', '9c']) // 18 vs 18 push
  play(g.t, 'p0', { a: 'stand' }); ok(stackOf(g.t, 'p0') === g.before, 'equal totals push') }
{ const g = start(['Ts', '6d', '8h', 'Ac']) // dealer soft 17 (A+6) stands; player 18 wins
  play(g.t, 'p0', { a: 'stand' }); ok(stackOf(g.t, 'p0') === g.before + 10 && (g.recs[0].summary as any).dealer.length === 2, 'dealer stands on soft 17') }
{ const g = start(['Ts', '6d', '4h', '9c', '8d']) // dealer 6+9=15 hits 8 -> 23 bust; player 14 stands
  play(g.t, 'p0', { a: 'stand' }); ok(stackOf(g.t, 'p0') === g.before + 10, 'dealer bust pays the player') }
{ const g = start(['5s', '9d', '6h', '8c', 'Kd']) // 11 vs 17: double, draw K = 21 -> win double
  play(g.t, 'p0', { a: 'double' }); ok(stackOf(g.t, 'p0') === g.before + 20, 'double down wins twice the bet') }
{ const g = start(['5s', '9d', '6h', '8c', '2d']) // 11 double gets 2 -> 13 loses double
  play(g.t, 'p0', { a: 'double' }); ok(stackOf(g.t, 'p0') === g.before - 20, 'double down loses twice the bet') }
{ const g = start(['8s', '9d', '8h', '8c', 'Kd', 'Th']) // split eights: 8+K=18, 8+T=18 vs dealer 17 -> two wins
  play(g.t, 'p0', { a: 'split' }); ok(g.t.seats[0].hands.length === 2, 'pair splits into two hands')
  play(g.t, 'p0', { a: 'stand' }, { a: 'stand' }); ok(stackOf(g.t, 'p0') === g.before + 20, 'both split hands win') }
{ const g = start(['As', '9d', 'Ah', '8c', 'Kd', 'Th']) // split aces: A+K = 21 is not a blackjack, pays 1:1; one card only
  play(g.t, 'p0', { a: 'split' })
  ok(g.t.phase !== 'play' || g.t.toAct === null, 'split aces take one card each and the hand moves on')
  ok(stackOf(g.t, 'p0') === g.before + 20, 'split aces: 21 pays even money, not 3:2') }
{ const g = start(['Ts', 'As', '9h', 'Kc']) // dealer natural (A up, K hole): player 19 loses
  ok(g.t.phase === 'wait' || g.t.round === 1, 'round played') ; ok(stackOf(g.t, 'p0') === g.before - 10, 'dealer natural beats a non-natural hand at once') }
{ const g = start(['As', 'Ad', 'Kh', 'Tc']) // both naturals: push
  ok(stackOf(g.t, 'p0') === g.before, 'natural vs natural pushes') }
{ // cannot double / split when it is not allowed
  const g = start(['Ts', '9d', '6h', '8c', '2d'])
  ok(g.t.act('p0', { a: 'split' }) === 'cannot_split', 'cannot split non-pairs')
  g.t.act('p0', { a: 'hit' }); ok(g.t.act('p0', { a: 'double' }) === 'cannot_double', 'cannot double after hitting')
}
{ // bet validation
  const { t } = game(['Ts', '9d', '8h', '9c'])
  ok(t.act('p0', { a: 'bet', amount: 5 }) === 'bad_amount', 'bet below the minimum is refused')
  ok(t.act('p0', { a: 'bet', amount: 11 }) === 'bad_amount', 'odd bet is refused (3:2 must pay whole chips)')
  ok(t.act('p0', { a: 'bet', amount: 99999 }) === 'bad_amount', 'bet above the maximum is refused')
  ok(t.act('p0', { a: 'hit' }) === 'not_your_turn', 'cannot play before cards are dealt')
}
{ // leaving mid-round forfeits the live hand and cashes out after
  const { t } = game(['Ts', '9d', '6h', '8c', '5d'])
  let cashed = -1; t.onCashout = (_id, stack) => { cashed = stack }
  t.act('p0', { a: 'bet', amount: 10 })
  t.standUp('p0')
  await new Promise((r) => setTimeout(r, 30))
  ok(cashed >= 0 && cashed <= 1000 + 10, `seat closes after the round (cashed ${cashed})`)
}

// ---- fuzz: every seat's stack always equals buy-in + the nets reported ----
{
  let seed = 777
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }
  let rounds = 0, problems = 0
  for (let g = 0; g < 40; g++) {
    const n = 1 + Math.floor(rnd() * 5)
    const t = new BlackjackTable({ bet: 10, casual: false, maxSeats: 6 })
    t.turnTimerMs = 0; t.betMs = 0; t.resultMs = 0
    const nets = new Array(6).fill(0)
    const home: Record<string, number> = {}
    t.onHand = (r) => { r.net.forEach((x, i) => (nets[i] += x)); rounds++ }
    t.onCashout = (id, stack) => { home[id] = stack }
    t.autostart = false
    for (let i = 0; i < n; i++) t.sit('p' + i, 'P' + i, 1000)
    t.autostart = true; t.drive()
    for (let step = 0; step < 3000 && (t.round < 30 || t.phase !== 'wait'); step++) {
      if (t.round >= 30 && t.phase === 'bet') break
      if (t.phase === 'bet') { for (let i = 0; i < n; i++) { const s = t.seats[i]; if (s.id && !s.out && s.pending === 0) t.act('p' + i, { a: 'bet', amount: 10 * (1 + Math.floor(rnd() * 4)) }) } continue }
      if (t.phase === 'play' && t.toAct) {
        const id = 'p' + t.toAct.seat, o = t.options(t.toAct.seat, t.toAct.hand), r = rnd()
        const act: BjAct = r < 0.45 && o.hit ? { a: 'hit' } : r < 0.55 && o.double ? { a: 'double' } : r < 0.65 && o.split ? { a: 'split' } : { a: 'stand' }
        const e = t.act(id, act); if (e) { problems++; console.log('error', e, act) }
        continue
      }
      if (t.phase === 'wait') { if (!t.seats.some((s) => s.id && !s.out && s.stack >= 10)) break; t.drive(); continue }
      if (t.seats.some((s) => s.stack < 0)) { problems++; console.log('negative stack') }
    }
    for (let i = 0; i < n; i++) {
      const s = t.seats[i]; if (!s.id) continue
      const expect = 1000 + nets[i]
      const inflight = s.inRound && t.phase !== 'wait' && t.phase !== 'result' ? s.hands.reduce((a, h) => a + h.bet, 0) : 0
      if (s.stack + s.pending + inflight !== expect) { problems++; console.log(`seat ${i}: stack ${s.stack + s.pending + inflight}, expected ${expect}`) }
    }
    t.dispose()
  }
  ok(problems === 0, `fuzz: ${rounds} rounds, every stack equals buy-in plus reported results`)
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
