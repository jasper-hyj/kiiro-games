// Run: npx tsx scripts/holdem/engine-test.ts
import { PokerTable, type PokerAct } from '../../src/games/holdem/engine/table'
import { best, categoryOf } from '../../src/games/holdem/engine/eval'

let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
// card helper: "As", "Td", "9h" ...
const R = '23456789TJQKA', S = 'shdc'
const C = (x: string) => R.indexOf(x[0]) + 13 * S.indexOf(x[1])
const H = (...x: string[]) => x.map(C)

// ---- evaluator ----
const rank = (...x: string[]) => best(H(...x))
ok(categoryOf(rank('As', 'Ks', 'Qs', 'Js', 'Ts')) === 8, 'royal flush is a straight flush')
ok(rank('5s', '4s', '3s', '2s', 'As') < rank('6s', '5s', '4s', '3s', '2s'), 'wheel is the lowest straight flush')
ok(categoryOf(rank('As', '2d', '3h', '4c', '5s')) === 4, 'A-5 wheel is a straight')
ok(categoryOf(rank('Qs', 'Kd', 'Ah', '2c', '3s')) === 0, 'no wrap-around straight (QKA23)')
ok(rank('9s', '9d', '9h', '9c', '2s') > rank('Ks', 'Kd', 'Kh', '2c', '2s'), 'quads beat a full house')
ok(rank('Ks', 'Kd', 'Kh', '2c', '2s') > rank('Qs', 'Qd', 'Qh', 'Ac', 'As'), 'kings full beats queens full')
ok(rank('As', 'Js', '9s', '5s', '2s') > rank('Kh', 'Qd', 'Jc', 'Td', '9s'), 'flush beats straight')
ok(rank('As', 'Ad', 'Kh', '2c', '3s') > rank('As', 'Ad', 'Qh', 'Jc', 'Ts'), 'pair of aces: kicker decides')
ok(rank('As', 'Ad', 'Ks', 'Kd', '2c') > rank('As', 'Ad', 'Qs', 'Qd', 'Kc'), 'two pair: second pair then kicker')
ok(best(H('As', 'Ad', '2c', '2d', '9s', '9h', 'Kc')) === best(H('As', 'Ad', '9s', '9h', 'Kc', '3c', '4d')), 'seven cards use the best five (three pairs)')
ok(best(H('2s', '3s', '4s', '5s', '9d', '9h', 'Kc')) < best(H('2s', '3s', '4s', '5s', '6s', '9h', 'Kc')), 'seventh card improves to a straight flush')
ok(rank('As', 'Kd', 'Qh', 'Jc', '9s') === rank('Ac', 'Kh', 'Qd', 'Js', '9d'), 'equal hands in different suits tie')

// ---- a table that never waits, with scripted decks ----
const hist: import('../../src/games/holdem/engine/table').HandResult[] = []
const mk = (n = 3, stacks: number[] = [], cfg = { sb: 25, bb: 50, casual: false, maxSeats: 6 }) => {
  const t = new PokerTable(cfg)
  t.turnTimerMs = 0; t.resultMs = 0
  const cash: Record<string, number> = {}
  hist.length = 0; t.onHand = (rec) => { hist.push({ handNo: rec.handNo, won: rec.net.map((n, i) => n + (t.seats[i]?.total ?? 0)), net: rec.net, pots: (rec.summary as any).pots, shown: [], board: [], byFold: false } as any) }
  t.onCashout = (id, stack) => { cash[id] = (cash[id] ?? 0) + stack }
  t.autostart = false
  for (let i = 0; i < n; i++) t.sit('p' + i, 'P' + i, stacks[i] ?? 2000)
  t.autostart = true
  return { t, cash }
}
const deckFor = (hole: string[][], board: string[]) => {
  // deal order: two rounds starting left of the button; the table pops from the end. Rig a stack so seat k gets hole[k].
  return { hole, board }
}
const total = (t: PokerTable) => t.seats.reduce((a, s) => a + s.stack + (t.street === 'wait' || t.street === 'showdown' ? 0 : s.total), 0)

// heads-up: button is the small blind and acts first before the flop
{
  const { t } = mk(2)
  t.drive()
  ok(t.street === 'preflop' && t.handNo === 1, 'two players start a hand')
  const sbSeat = t.button
  ok(t.seats[sbSeat].bet === 25 && t.toAct === sbSeat, 'heads-up: button posts the small blind and acts first')
  ok(t.seats[1 - sbSeat].bet === 50, 'other player posts the big blind')
  ok(t.act('p' + (1 - sbSeat), { a: 'fold' }) === 'not_your_turn', 'cannot act out of turn')
  t.act('p' + sbSeat, { a: 'fold' })
  ok(t.street === 'wait' || t.handNo === 2, 'fold ends the hand and the next one starts')
  ok(total(t) === 4000, 'chips conserved after a fold')
}

// full rig: seats 0..2 in a 3-handed table; button moves each hand
{
  const { t, cash } = mk(3, [2000, 2000, 2000])
  // build a deck so that the player who is first dealt (left of button) gets A A, next K K, button gets 2 7
  t.riggedDeck = null
  t.drive()
  const order = [1, 2, 0].map((x) => (t.button + x) % 3) // dealing order: left of button first
  const hole = [['As', 'Ad'], ['Ks', 'Kd'], ['2c', '7h']]
  const board = ['Qh', 'Jc', '4d', '9s', '3h']
  // new rigged hand: end the current one cleanly by everybody folding to the big blind, then rig the next
  while (t.handNo === 1 && t.toAct >= 0) t.act('p' + t.toAct, { a: 'fold' })
  const first = (t.button + 1) % 3
  void first; void order; void hole; void board
  ok(total(t) === 6000, 'three-handed: chips conserved after folds')
  void cash
}

// side pots: three all-in players with different stacks, rigged so the shortest stack has the best hand
{
  const { t, cash } = mk(3, [500, 1000, 2000], { sb: 10, bb: 25, casual: false, maxSeats: 6 })
  const cfgDeck = (): number[] => {
    // we do not know who is where until the hand starts, so rig after seeing the button
    return []
  }
  void cfgDeck
  // determine deal order by simulating: button for hand 1
  const probe = new PokerTable({ sb: 10, bb: 25, casual: false, maxSeats: 6 }); probe.turnTimerMs = 0; probe.resultMs = 0
  probe.autostart = false
  for (let i = 0; i < 3; i++) probe.sit('p' + i, 'P' + i, 1000)
  probe.autostart = true; probe.drive()
  const button = probe.button
  const dealOrder = [1, 2, 3].map((k) => (button + k) % 3) // left of the button first
  const holes: Record<number, string[]> = {}
  // seat strengths: short stack (seat 0) AA, mid (seat 1) KK, big (seat 2) QQ
  holes[0] = ['As', 'Ad']; holes[1] = ['Ks', 'Kd']; holes[2] = ['Qs', 'Qd']
  const deck: string[] = []
  // cards are popped from the end, so build the deck reversed: the last element is dealt first
  const dealt: string[] = []
  for (let r = 0; r < 2; r++) for (const seat of dealOrder) dealt.push(holes[seat][r])
  const boardCards = ['2c', '7d', '9h', '4s', '5c']
  // order of pops: 6 hole cards, then burn, flop x3, burn, turn, burn, river
  const seq = [...dealt, 'Xx', boardCards[0], boardCards[1], boardCards[2], 'Xx', boardCards[3], 'Xx', boardCards[4]]
  const used = new Set(seq.filter((c) => c !== 'Xx').map(C))
  const spare = Array.from({ length: 52 }, (_, i) => i).filter((c) => !used.has(c))
  const full = seq.map((c) => (c === 'Xx' ? spare.pop()! : C(c)))
  t.riggedDeck = full.reverse()
  void deck
  t.drive()
  ok(t.button === button, 'same button as the probe table')
  // everybody shoves
  let guard = 0
  while (t.street !== 'showdown' && t.street !== 'wait' && guard++ < 20) { if (t.toAct < 0) break; t.act('p' + t.toAct, { a: 'allin' }) }
  ok(hist.length >= 1 && hist[0].handNo === 1, 'all-in hand reaches a result')
  const res = hist[0]
  // seat 0 (500) wins the main pot of 1500; seat 1 (1000) wins the side pot of 1000 against seat 2; seat 2 gets 1000 back
  ok(res.won[0] === 1500, `short stack AA wins the 1500 main pot (got ${res.won[0]})`)
  ok(res.won[1] === 1000, `KK wins the 1000 side pot (got ${res.won[1]})`)
  ok(res.won[2] === 0 && res.net[2] === -1000, `big stack only risks what can be called: loses 1000, keeps 1000 behind (net ${res.net[2]})`)
  ok(res.pots.length === 2, 'two pots (main and side)')
  void cash
}

// split pot and odd chip
{
  const { t } = mk(2, [1000, 1000])
  const probe = new PokerTable({ sb: 25, bb: 50, casual: false, maxSeats: 6 }); probe.turnTimerMs = 0; probe.resultMs = 0
  probe.autostart = false; probe.sit('a', 'a', 1000); probe.sit('b', 'b', 1000); probe.autostart = true; probe.drive()
  const button = probe.button, other = 1 - button
  const dealOrder = [other, button]
  const holes: Record<number, string[]> = { 0: ['2c', '3d'], 1: ['2h', '3s'] }
  const dealt: string[] = []; for (let r = 0; r < 2; r++) for (const seat of dealOrder) dealt.push(holes[seat][r])
  const board = ['As', 'Ks', 'Qd', 'Jh', 'Th']
  const seq = [...dealt, 'Xx', board[0], board[1], board[2], 'Xx', board[3], 'Xx', board[4]]
  const used = new Set(seq.filter((c) => c !== 'Xx').map(C))
  const spare = Array.from({ length: 52 }, (_, i) => i).filter((c) => !used.has(c))
  t.riggedDeck = seq.map((c) => (c === 'Xx' ? spare.pop()! : C(c))).reverse()
  t.drive()
  let guard = 0
  while (t.street !== 'showdown' && guard++ < 30) { const me = t.toAct; if (me < 0) break; const info = t.turnInfo(me); t.act('p' + me, info.canCheck ? { a: 'check' } : { a: 'call' }) }
  ok(hist[0]?.pots[0].winners.length === 2, 'board straight plays: pot is split')
  ok(total(t) === 2000, 'chips conserved after a split')
}

// validation
{
  const { t } = mk(3)
  t.drive()
  const me = t.toAct, id = 'p' + me
  ok(t.act(id, { a: 'check' }) === 'cannot_check', 'cannot check facing the big blind')
  ok(t.act(id, { a: 'raise', to: 60 }) === 'bad_amount', 'raise below the minimum is refused')
  ok(t.act(id, { a: 'raise', to: 99999 }) === null && t.seats[me].allIn, 'a raise above the stack becomes an all-in')
  ok(t.sit('zz', 'Z', 10).ok === false, 'buy-in below the minimum is refused')
  ok(t.sit('zz', 'Z', 99999).ok === false, 'buy-in above the maximum is refused')
}

// ---- fuzz: random play, chips must always be conserved ----
{
  let seed = 12345
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }
  let hands = 0, problems = 0
  for (let g = 0; g < 60; g++) {
    const n = 2 + Math.floor(rnd() * 5)
    const { t, cash } = mk(n, Array.from({ length: n }, () => 1000 + Math.floor(rnd() * 5) * 1000), { sb: 25, bb: 50, casual: false, maxSeats: 6 })
    t.rand = (k) => Math.floor(rnd() * k)
    const initial = total(t)
    let leftEarly = 0
    for (let step = 0; step < 4000 && t.handNo < 40; step++) {
      t.drive()
      if (t.street === 'wait' && t.seats.filter((s) => s.id && s.stack > 0 && !s.out).length < 2) break
      if (t.toAct < 0) { if (t.street === 'wait' || t.street === 'showdown') { t.drive(); continue } else { problems++; console.log('stuck street', t.street); break } }
      const i = t.toAct, info = t.turnInfo(i), id = 'p' + i
      const roll = rnd()
      let a: PokerAct
      if (roll < 0.12) a = { a: 'fold' }
      else if (roll < 0.5) a = info.canCheck ? { a: 'check' } : { a: 'call' }
      else if (roll < 0.8 && info.canRaise) a = { a: 'raise', to: info.minRaiseTo + Math.floor(rnd() * Math.max(1, info.maxRaiseTo - info.minRaiseTo)) }
      else if (roll < 0.9) a = { a: 'allin' }
      else a = info.canCheck ? { a: 'check' } : { a: 'fold' }
      const err = t.act(id, a)
      if (err && err !== 'cannot_raise' && err !== 'bad_amount') { problems++; console.log('unexpected error', err, JSON.stringify(a)) }
      if (t.seats.some((s) => s.stack < 0 || s.bet < 0)) { problems++; console.log('negative chips') }
      const inPots = t.seats.reduce((x, s) => x + s.total, 0)
      const stacks = t.seats.reduce((x, s2) => x + s2.stack, 0)
      const homeNow = Object.values(cash).reduce((x, y) => x + y, 0)
      if (t.street !== 'showdown' && t.street !== 'wait' && stacks + inPots + homeNow !== initial) { problems++; console.log('chip leak mid-hand', stacks, inPots, initial) }
      if (rnd() < 0.01 && t.street === 'wait') { const s = t.seats.findIndex((x) => x.id); if (s >= 0) { t.standUp(t.seats[s].id!); leftEarly++ } }
    }
    hands += t.handNo
    // everyone cashes out: all chips must come home
    for (const s of [...t.seats]) if (s.id) t.standUp(s.id)
    const home = Object.values(cash).reduce((x, y) => x + y, 0)
    if (home + t.seats.reduce((x, s) => x + s.stack, 0) !== initial) { problems++; console.log(`game ${g}: ${home} came home, expected ${initial}`) }
    t.dispose()
  }
  ok(problems === 0, `fuzz: ${hands} hands over 60 tables, chips conserved, no stuck hands`)
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
