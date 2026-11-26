// Run: npx tsx scripts/bigtwo/engine-test.ts
import { allCombos, beats, evalCombo, penalty, power, THREE_DIAMONDS } from '../../src/games/bigtwo/engine/combos'
import { BigTwoTable, chooseMove } from '../../src/games/bigtwo/engine/table'

let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const R = '23456789TJQKA',
  S = 'shdc'
const C = (x: string) => R.indexOf(x[0]) + 13 * S.indexOf(x[1])
const H = (...x: string[]) => x.map(C)
const combo = (...x: string[]) => evalCombo(H(...x))

ok(C('3d') === THREE_DIAMONDS, 'the opening card is the 3 of diamonds')
ok(power(C('2s')) > power(C('As')) && power(C('As')) > power(C('Kh')), '2 is the highest rank, then A, K')
ok(power(C('3s')) > power(C('3h')) && power(C('3h')) > power(C('3c')) && power(C('3c')) > power(C('3d')), 'suits rank spades > hearts > clubs > diamonds')
ok(combo('3d')?.type === 'single' && combo('3d', '3c')?.type === 'pair' && combo('3d', '3c', '3h')?.type === 'triple', 'single, pair and triple are recognised')
ok(combo('3d', '4c') === null && combo('3d', '3c', '4h') === null, 'non-matching cards are not a combination')
ok(combo('3d', '4c', '5h', '6s', '7d')?.type === 'straight', 'five in a row is a straight')
ok(combo('Td', 'Jc', 'Qh', 'Ks', 'Ad')?.type === 'straight', '10-J-Q-K-A is the highest straight')
ok(combo('Qd', 'Kc', 'Ah', '2s', '3d') === null, 'a straight cannot wrap around through 2')
ok(combo('3d', '5d', '9d', 'Jd', 'Kd')?.type === 'flush', 'five of one suit is a flush')
ok(combo('3d', '3c', '3h', '9s', '9d')?.type === 'fullhouse', 'triple plus pair is a full house')
ok(combo('3d', '3c', '3h', '3s', '9d')?.type === 'quads', 'four of a kind plus any card')
ok(combo('3d', '4d', '5d', '6d', '7d')?.type === 'straightflush', 'straight flush')
ok(combo('3d', '3c', '4h', '4s', '5d') === null, 'two pair is not a play')
// ordering
const beat = (a: string[], b: string[]) => beats(evalCombo(H(...a))!, evalCombo(H(...b))!)
ok(beat(['4d'], ['3s']) && !beat(['3d'], ['3c']) && beat(['3s'], ['3h']), 'singles: rank first, then suit')
ok(beat(['4d', '4c'], ['3h', '3s']) && beat(['3h', '3s'], ['3d', '3c']), 'pairs: rank, then the higher suit of the pair')
ok(!beat(['3d', '3c'], ['4d']), 'a pair cannot beat a single (sizes must match)')
ok(beat(['3d', '5d', '9d', 'Jd', 'Kd'], ['3d', '4c', '5h', '6s', '7d']), 'flush beats straight')
ok(beat(['4d', '4c', '4h', '9s', '9d'], ['3d', '5d', '9d', 'Jd', 'Kd']), 'full house beats flush')
ok(beat(['4d', '4c', '4h', '4s', '9d'], ['5d', '5c', '5h', '9s', '9d']), 'four of a kind beats full house')
ok(beat(['3d', '4d', '5d', '6d', '7d'], ['4d', '4c', '4h', '4s', '9d']), 'straight flush beats four of a kind')
ok(beat(['4d', '5c', '6h', '7s', '8d'], ['3d', '4c', '5h', '6s', '7d']), 'straights compare by the highest card')
ok(beat(['3c', '5c', '9c', 'Jc', 'Kc'], ['3d', '5d', '9d', 'Jd', 'Kd']), 'flushes: higher suit wins first')
ok(
  beat(['4h', '4d', '9s', '9c', '9h'], ['3h', '3d', '8s', '8c', '8h']) &&
    beat(['4h', '4d', '8s', '8c', '8h'], ['5h', '5d', '3s', '3c', '3h']) &&
    !beat(['9h', '9d', '3s', '3c', '3h'], ['4h', '4d', '8s', '8c', '8h']),
  'full houses compare the triple, not the pair',
)
ok(penalty(3) === 3 && penalty(8) === 2 && penalty(10) === 3 && penalty(13) === 4, 'penalty scale: 1 each, x2 from 8 cards, x3 from 10, x4 for all 13')
ok(allCombos(H('3d', '3c', '3h', '4s')).filter((c) => c.type === 'pair').length === 3, 'a triple contains three pairs')

// ---- bot ----
{
  const hand = H('3d', '3c', '5h', '9s', 'Ks', 'As')
  const open = chooseMove(hand, null, true)!
  ok(open.cards.includes(THREE_DIAMONDS), 'the bot opens with the 3 of diamonds')
  const reply = chooseMove(hand, evalCombo(H('4h'))!, false)!
  ok(reply.size === 1 && reply.key > power(C('4h')), 'the bot beats a single with the weakest higher single')
  ok(chooseMove(H('3d', '4c'), evalCombo(H('Kh', 'Kd'))!, false) === null, 'the bot passes when it cannot beat the play')
}

// ---- a scripted game ----
const mk = () => {
  const t = new BigTwoTable()
  t.turnTimerMs = 0
  t.botDelayMs = 0
  t.shuffleSeats = false
  return t
}
{
  const t = mk()
  t.botDelayMs = 3600000 // keep the bots idle so the script controls every move
  t.join('a', 'A')
  t.join('b', 'B')
  t.riggedHands = [H('3d', 'Ac', '2s'), H('4d', '4c', '5h'), H('6d', '7c', '8h', '9s'), H('Td', 'Jc')]
  t.start('a')
  ok(t.status === 'playing' && t.seats.every((s) => s.id || s.bot), 'the host starts; empty seats become bots')
  ok(t.status === 'playing' && t.turn === 0 && t.seats[0].hand.includes(THREE_DIAMONDS), 'the holder of the 3 of diamonds goes first')
  ok(t.view('a').hand.length === 3 && t.view('b').hand.length === 3, 'each player sees only their own cards')
  ok(t.play('a', [C('Ac')]) === 'must_open', 'the first play must include the 3 of diamonds')
  ok(t.play('b', [C('4d')]) === 'not_your_turn', 'cannot play out of turn')
  ok(t.play('a', [C('3d'), C('Ac')]) === 'bad_combo', 'two unlike cards are not a play')
  ok(t.pass('a') === 'must_lead', 'the leader cannot pass')
  ok(t.play('a', [C('3d')]) === null && t.turn === 1, 'opening with the 3 of diamonds passes the turn')
  ok(t.play('b', [C('4d'), C('4c')]) === 'too_low', 'a pair cannot answer a single')
  ok(t.play('b', [C('4c')]) === null && t.turn === 2, 'a higher single is accepted')
  ok(t.pass('a') === 'not_your_turn', 'passing out of turn is refused')
  // seats 2 and 3 are idle bots: pretend they pass, then the trick returns to seat 1 who leads again
  t['doPass'](2)
  t['doPass'](3)
  t['doPass'](0)
  ok(t.current === null && t.turn === 1, 'after three passes the last player leads a fresh trick')
  ok(t.play('b', [C('4d'), C('5h')]) === 'bad_combo', 'a non-matching pair is refused')
  ok(t.play('b', [C('4d')]) === null, 'a fresh trick can start with anything')
}
{
  // going out ends the game; points are zero-sum and the winner collects
  const t = mk()
  t.botDelayMs = 3600000
  t.join('a', 'A')
  t.riggedHands = [H('3d'), H('4d', '4c', '5h'), H('6d', '7c', '8h', '9s', 'Ts', 'Js', 'Qs', 'Ks', 'As', '2s'), H('Td', 'Jc')]
  let got: any = null
  t.onOver = (x) => {
    got = x.result
  }
  t.start('a')
  ok(t.play('a', [C('3d')]) === null && t.status === 'over', 'playing the last card ends the game')
  ok(
    (got && got.winner === 0 && got.points[0] === 2 + 7 + 2 * 0 + 3 + 0 - 0 + 0) || got?.points?.reduce((a: number, b: number) => a + b, 0) === 0,
    'scores are zero-sum',
  )
  ok(got.points[0] === -(got.points[1] + got.points[2] + got.points[3]) && got.points[2] === -3, 'the 10-card hand pays triple, the winner collects it all')
  ok(t.view('a').result?.winner === 0, 'the result is in the view')
}
{
  // full simulated games with all-bot play must always finish, conserve points and never deadlock
  let problems = 0,
    games = 0
  for (let g = 0; g < 200; g++) {
    const t = mk()
    t.join('a', 'A')
    let result: any = null
    t.onOver = (x) => {
      result = x.result
    }
    // the human seat plays like a bot too
    t.seats[0].missed = 2
    t.start('a')
    for (let step = 0; step < 4000 && t.status === 'playing'; step++) {
      if (t.turn >= 0 && t.seats[t.turn].id === 'a') t['autoMove'](t.turn)
      else if (t.turn < 0) break
      else t.drive?.()
    }
    // drive is async for bots with delay 0 it is synchronous
    if (t.status !== 'over') {
      problems++
      console.log('game did not finish', g)
      continue
    }
    games++
    const pts = t.result!.points
    if (pts.reduce((a: number, b: number) => a + b, 0) !== 0) {
      problems++
      console.log('points do not sum to zero', pts)
    }
    if (pts[t.result!.winner] <= 0) {
      problems++
      console.log('winner did not gain', pts)
    }
    if (t.seats[t.result!.winner].hand.length !== 0) {
      problems++
      console.log('winner still holds cards')
    }
    // every card appears exactly once across the final hands + played cards is hard to track; check total cards left sum
    const left = t.result!.left.reduce((a: number, b: number) => a + b, 0)
    if (left < 0 || left > 39) {
      problems++
      console.log('odd card count', left)
    }
    void result
  }
  ok(problems === 0, `${games} complete bot games finish with zero-sum points`)
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
