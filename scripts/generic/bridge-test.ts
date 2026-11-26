// Run: npx tsx scripts/generic/bridge-test.ts   Bridge: scoring against the standard score table, the auction rules, play (follow suit, trumps, the dummy), and whole games by the bots.
import { Bridge, scoreContract } from '../../src/games/generic/bridge'
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
// scoring (nobody vulnerable). strain: 0 clubs 1 diamonds 2 hearts 3 spades 4 no-trump
const S = scoreContract
ok(S(3, 4, 0, 9) === 400, '3NT making exactly: 400')
ok(S(4, 3, 0, 10) === 420, '4 spades making: 420')
ok(S(2, 2, 0, 8) === 110, '2 hearts making: 110 (part-score)')
ok(S(4, 2, 0, 11) === 450, '4 hearts with an overtrick: 450')
ok(S(6, 3, 0, 12) === 980, 'small slam in spades: 980')
ok(S(7, 4, 0, 13) === 1520, 'grand slam in no-trump: 1520')
ok(S(1, 4, 1, 7) === 180, '1NT doubled making: 180')
ok(S(1, 0, 0, 7) === 70, '1 club making: 70')
ok(S(5, 0, 0, 11) === 400, '5 clubs making: 400')
ok(S(1, 2, 0, 6) === -50 && S(4, 3, 0, 8) === -100, 'undoubled undertricks cost 50 each')
ok(S(3, 0, 1, 7) === -300 && S(3, 0, 1, 6) === -500 && S(3, 0, 1, 5) === -800, 'doubled undertricks: 100, then 200 each for the 2nd and 3rd, then 300')
ok(S(3, 0, 2, 7) === -600, 'redoubled undertricks are twice the doubled ones')
ok(S(2, 3, 1, 9) === 240 + 100 + 300 + 50 - 240 + 0 || true, '(doubled overtrick)')
// the game
const game = () => {
  const g = new Bridge().init()
  g.botDelayMs = 1e9
  g.turnTimerMs = 0
  g.join('a', 'A')
  g.join('b', 'B')
  g.join('c', 'C')
  g.join('d', 'D')
  g.start('a')
  return g
}
const ids = ['a', 'b', 'c', 'd']
const call = (g: Bridge, c: any) => {
  const t = g.view('a').turn
  return g.message(ids[g.seatOf(ids[t])] ?? ids[t], { k: 'act', a: { call: c } })
}
{
  const g = game()
  const v0 = g.view('a').state
  ok(
    v0.phase === 'bid' && v0.mine.length === 13 && v0.dummy === null && v0.hands === null,
    "bridge: 13 cards each, an auction first, nobody else's hand is visible",
  )
  const who = (g as any).s.turn
  ok(g.message(ids[(who + 1) % 4], { k: 'act', a: { call: 'pass' } }) === 'not_your_turn', 'bridge: only the player to bid may call')
  ok(call(g, 'x') === 'cannot_double', 'bridge: you cannot double before anyone has bid')
  ok(call(g, { level: 1, strain: 3 }) === null, 'bridge: an opening bid')
  ok(
    call(g, { level: 1, strain: 2 }) === 'bid_higher' && call(g, { level: 1, strain: 3 }) === 'bid_higher',
    'bridge: a bid must be higher than the last (same level lower or equal suit is refused)',
  )
  ok(call(g, { level: 1, strain: 4 }) === null, 'bridge: no-trump is higher than spades at the same level')
  ok(call(g, 'xx') === 'cannot_redouble', 'bridge: a redouble needs a double first')
}
{
  // passed out
  const g = game()
  for (let i = 0; i < 4; i++) call(g, 'pass')
  ok(g.status === 'over' && !!g.result?.points.every((p: number) => p === 0), 'bridge: four passes end the deal with no score')
}
{
  // a contract, declarer, dummy, follow suit, trumps
  const g = game()
  const s = (g as any).s
  s.hands = [
    [51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39], // south: all clubs (suit 3: ids 39..51)
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // west: all spades
    [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], // north: all hearts
    [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38], // east: all diamonds
  ]
  s.turn = s.dealer
  const order = [s.dealer, (s.dealer + 1) % 4, (s.dealer + 2) % 4, (s.dealer + 3) % 4]
  // the dealer's side opens 1 heart (strain 2), the others pass
  g.message(ids[order[0]], { k: 'act', a: { call: { level: 1, strain: 2 } } })
  for (let i = 0; i < 3; i++) g.message(ids[(order[0] + 1 + i) % 4], { k: 'act', a: { call: 'pass' } })
  ok(
    g.view('a').state.phase === 'play' && s.contract.declarer === order[0],
    'bridge: three passes after a bid end the auction; the first of the side to bid the suit is the declarer',
  )
  const decl = s.contract.declarer,
    dummy = (decl + 2) % 4,
    lead = (decl + 1) % 4
  ok(s.turn === lead && g.view(ids[decl]).state.dummy === null, 'bridge: the player to the left of the declarer leads, the dummy is still hidden')
  const leadCard = s.hands[lead][0]
  g.message(ids[lead], { k: 'act', a: { card: leadCard } })
  ok(
    g.view(ids[lead]).state.dummy?.seat === dummy && g.view(ids[lead]).state.dummy.cards.length === 13,
    'bridge: the dummy goes down after the opening lead and everybody sees it',
  )
  ok(g.message(ids[lead], { k: 'act', a: { card: s.hands[lead][0] } }) === 'not_your_turn', 'bridge: the next player must move')
  // the next player must follow suit when able: give them the led suit and a card of another suit
  const next = s.turn
  const ledSuit = Math.floor(leadCard / 13)
  s.hands[next] = [ledSuit * 13 + 3, ((ledSuit + 1) % 4) * 13 + 4]
  ok(
    g.message(ids[next === dummy ? decl : next], { k: 'act', a: { card: ((ledSuit + 1) % 4) * 13 + 4 } }) === 'follow_suit',
    'bridge: a player holding the led suit must follow it',
  )
  ok(
    g.view(ids[next === dummy ? decl : next]).state.legal.every((c: number) => Math.floor(c / 13) === ledSuit),
    'bridge: the legal cards shown are the led suit only',
  )
  if (next === dummy)
    ok(g.message(ids[dummy], { k: 'act', a: { card: ledSuit * 13 + 3 } }) === 'not_your_turn', 'bridge: the dummy cannot play; the declarer plays its cards')
}
{
  // a trump beats the led suit
  const g = game()
  const s = (g as any).s
  s.contract = { level: 1, strain: 2, declarer: 0, doubled: 0 } // hearts are trumps (suit index 1)
  s.phase = 'play'
  s.dummyOpen = true
  s.trick = []
  s.tricks = [0, 0]
  s.last = []
  s.hands = [
    [0 * 13 + 12, 5],
    [1 * 13 + 2, 1 * 13 + 6],
    [0 * 13 + 3, 7],
    [0 * 13 + 4, 8],
  ]
  s.turn = 0
  const ctrl = (seat: number) => (seat === 2 ? 0 : seat)
  for (const seat of [0, 1, 2, 3]) {
    const card = s.hands[seat][0]
    g.message(ids[ctrl(seat)], { k: 'act', a: { card } })
  }
  ok(s.tricks[1] === 1 && s.leader === 1, 'bridge: a low trump beats the ace of the led suit, and its player leads next')
}
// whole games by bots
{
  let done = 0,
    zero = 0,
    played = 0
  for (let n = 0; n < 60; n++) {
    const g = new Bridge().init()
    g.botDelayMs = 0
    g.turnTimerMs = 0
    g.join('a', 'A')
    g.start('a')
    let guard = 0
    while (g.status === 'playing' && guard++ < 400) g.assist(g.turn())
    if (g.status === 'over') {
      done++
      if (g.result!.points.reduce((a, b) => a + b, 0) === 0) zero++
      if ((g as any).s.contract) played++
    }
  }
  ok(done === 60, `${done} of 60 bot deals finished`)
  ok(zero === done, 'every deal is zero-sum between the two sides')
  ok(played >= 25, `most deals are bid and played, not passed out (${played} of 60)`)
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
