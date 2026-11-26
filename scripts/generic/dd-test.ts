// Run: npx tsx scripts/generic/dd-test.ts   Dou Dizhu: which card sets are legal plays, what beats what, bidding, scoring, and whole games played by the bots.
import { beats, classify, DouDizhu, options } from '../../src/games/doudizhu/engine'
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
// card ids: suit * 13 + rank, rank 0 = 3 ... 7 = 10, 8 = J, 9 = Q, 10 = K, 11 = A, 12 = 2; 52 small joker, 53 big joker
const R = (...ranks: number[]) => {
  const used: Record<number, number> = {}
  return ranks.map((r) => {
    const k = used[r] ?? 0
    used[r] = k + 1
    return k * 13 + r
  })
}
const type = (cards: number[]) => classify(cards)?.type ?? null
ok(type(R(5)) === 'single' && type(R(5, 5)) === 'pair' && type(R(5, 5, 5)) === 'triple', 'single, pair and triple')
ok(type(R(5, 5, 5, 8)) === 'triple1' && type(R(5, 5, 5, 8, 8)) === 'triple2' && type(R(5, 5, 5, 8, 9)) === null, 'a triple with one card or with a pair')
ok(type(R(5, 5, 5, 5)) === 'bomb' && type([52, 53]) === 'rocket', 'a bomb and the rocket')
ok(type(R(0, 1, 2, 3, 4)) === 'straight' && type(R(0, 1, 2, 3)) === null && type(R(7, 8, 9, 10, 11)) === 'straight', 'a straight needs five in a row')
ok(type(R(9, 10, 11, 12, 0)) === null && type(R(8, 9, 10, 11, 12)) === null, 'a straight never contains a 2')
ok(type(R(0, 0, 1, 1, 2, 2)) === 'pairs' && type(R(0, 0, 1, 1)) === null, 'a pair straight needs three pairs')
ok(
  type(R(3, 3, 3, 4, 4, 4)) === 'plane' && type(R(3, 3, 3, 4, 4, 4, 0, 9)) === 'plane1' && type(R(3, 3, 3, 4, 4, 4, 0, 0, 9, 9)) === 'plane2',
  'a plane, with single wings, with pair wings',
)
ok(type(R(3, 3, 3, 3, 0, 9)) === 'four2' && type(R(3, 3, 3, 3, 0, 0, 9, 9)) === 'four22', 'four with two cards, four with two pairs')
ok(type(R(3, 3, 5, 5)) === null && type(R(3, 4)) === null, 'two different cards are not a play')
// beating
const c = (cards: number[]) => classify(cards)!
ok(beats(c(R(6)), c(R(5))) && !beats(c(R(5)), c(R(6))) && !beats(c(R(5)), c(R(5))), 'a higher single beats a lower one, equal does not')
ok(beats(c([53]), c([52])) && beats(c(R(12)), c([53])) === false, 'jokers rank above 2s, the big joker above the small')
ok(!beats(c(R(6, 6)), c(R(5))), 'a pair cannot answer a single')
ok(beats(c(R(0, 0, 0, 0)), c(R(12, 12, 12))) && !beats(c(R(12, 12, 12)), c(R(0, 0, 0, 0))), 'a bomb beats any non-bomb')
ok(beats(c(R(6, 6, 6, 6)), c(R(5, 5, 5, 5))) && beats(c([52, 53]), c(R(12, 12, 12, 12))), 'a higher bomb beats a lower one and the rocket beats a bomb')
ok(!beats(c(R(0, 1, 2, 3, 4, 5)), c(R(1, 2, 3, 4, 5))), 'straights must have the same length')
ok(beats(c(R(1, 2, 3, 4, 5)), c(R(0, 1, 2, 3, 4))), 'a higher straight beats a lower one')
// the options a player has
{
  const hand = R(0, 0, 4, 4, 4, 9, 11, 12)
  const o = options(hand, c(R(3, 3)))
  ok(
    o.every((x) => beats(x, c(R(3, 3)))) &&
      o.some((x) => x.type === 'pair' && x.rank === 4) &&
      o.some((x) => x.type === 'pair' && x.rank === 4 && x.cards.length === 2),
    'the options that answer a pair are pairs of a higher rank',
  )
  const lead = options(hand, null)
  ok(lead.some((x) => x.type === 'triple1') && lead.some((x) => x.type === 'single'), 'leading offers triples with a kicker and singles')
}

// a game: bidding, the landlord, passing, scoring
const game = () => {
  const g = new DouDizhu().init()
  g.botDelayMs = 1e9
  g.turnTimerMs = 0
  g.join('h', 'H')
  g.start('h')
  return g
}
{
  const g = game()
  ok(g.view('h').state.phase === 'bid' && g.view('h').state.hand.length === 17, 'dou dizhu: 17 cards each and the bidding starts')
  const me = g.seatOf('h')
  ;(g as any).s.turn = me
  ;(g as any).s.bids = [null, null, null]
  ;(g as any).s.high = 0
  ok(g.message('h', { k: 'act', a: { bid: 5 } }) === 'bad_bid', 'dou dizhu: a bid is 0 to 3')
  g.message('h', { k: 'act', a: { bid: 2 } })
  ok((g as any).s.high === 2 && g.turn() === (me + 1) % 3, 'dou dizhu: a bid passes the turn')
  const nxt = (me + 1) % 3
  ;(g as any).s.turn = nxt
  ok((g as any).act(nxt, { bid: 2 }) === 'bid_higher', 'dou dizhu: a bid must be higher than the last')
  ;(g as any).act(nxt, { bid: 3 })
  ok(
    (g as any).s.phase === 'play' && (g as any).s.landlord === nxt && (g as any).s.hands[nxt].length === 20,
    'dou dizhu: a bid of 3 ends the bidding; the landlord takes the three extra cards',
  )
}
{
  // everyone passes: new deal
  const g = game()
  const s = (g as any).s
  for (let i = 0; i < 3; i++) (g as any).act(s.turn, { bid: 0 })
  ok((g as any).s.phase === 'bid' && (g as any).s.redeals === 1, 'dou dizhu: if everyone passes the cards are dealt again')
}
{
  // playing: lead, follow, pass, bomb doubles, scoring
  const g = game()
  const s = (g as any).s
  s.phase = 'play'
  s.landlord = 0
  s.high = 2
  s.turn = 0
  s.last = null
  s.passes = 0
  s.bombs = 0
  s.played = [0, 0, 0]
  s.recent = [null, null, null]
  s.hands = [R(0, 0, 0, 0, 5, 9), R(3, 3, 8, 8, 12), R(4, 6, 7, 11)]
  const act = (seat: number, a: any) => (g as any).act(seat, a)
  s.turn = 0
  ok(act(0, { pass: true }) === 'must_lead', 'dou dizhu: the leader cannot pass')
  ok(act(0, { cards: R(0, 0, 0, 0) }) === null && s.bombs === 1, 'dou dizhu: a bomb can lead and counts')
  ok(act(1, { cards: R(3) }) === 'too_low' || act(1, { cards: R(3, 3) }) === 'too_low', 'dou dizhu: a play that does not beat the bomb is refused')
  ok(
    act(1, { pass: true }) === null && act(2, { pass: true }) === null && s.last === null && s.turn === 0,
    'dou dizhu: two passes give the lead back to the last player',
  )
  ok(
    act(0, { cards: R(5) }) === null &&
      act(1, { cards: R(12) }) === null &&
      act(2, { pass: true }) === null &&
      act(0, { pass: true }) === null &&
      s.turn === 1 &&
      s.last === null,
    'dou dizhu: a trick won by a farmer is led by that farmer',
  )
  // the landlord goes out: wins 2x(bid 2 x 2 for the bomb), farmers pay
  s.turn = 0
  s.last = null
  s.hands[0] = R(9)
  act(0, { cards: R(9) })
  const out = (g as any).outcome()
  ok(
    out &&
      out.winner === 0 &&
      out.points[0] === 8 &&
      out.points[1] === -4 &&
      out.points[2] === -4 &&
      out.points.reduce((a: number, b: number) => a + b, 0) === 0,
    `dou dizhu: the landlord wins double (bid 2, one bomb), zero-sum (${JSON.stringify(out?.points)})`,
  )
}
{
  // the farmers win
  const g = game()
  const s = (g as any).s
  s.phase = 'play'
  s.landlord = 0
  s.high = 1
  s.turn = 1
  s.last = null
  s.bombs = 0
  s.played = [3, 0, 0]
  s.hands = [R(0, 1, 2), R(5), R(7, 8)]
  ;(g as any).act(1, { cards: R(5) })
  const out = (g as any).outcome()
  ok(
    out.winner === 1 && out.points[0] < 0 && out.points[1] > 0 && out.points[2] > 0 && out.points.reduce((a: number, b: number) => a + b, 0) === 0,
    'dou dizhu: when a farmer goes out both farmers win',
  )
}
// whole games by bots
{
  let done = 0,
    zero = 0
  for (let n = 0; n < 40; n++) {
    const g = new DouDizhu().init()
    g.botDelayMs = 0
    g.turnTimerMs = 0
    g.join('h', 'H')
    g.start('h')
    let guard = 0
    while (g.status === 'playing' && guard++ < 3000) g.assist(g.turn())
    if (g.status === 'over') {
      done++
      if (g.result!.points.reduce((a, b) => a + b, 0) === 0) zero++
    }
  }
  ok(done === 40, `${done} of 40 bot games finished`)
  ok(zero === done, 'every bot game is zero-sum')
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
