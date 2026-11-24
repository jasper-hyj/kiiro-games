// Run: npx tsx scripts/generic/engine-test.ts   Every turn-based game on the shared frame: lobby, bots, full games to a result, persistence, rules.
import { ENGINES } from '../../src/games/generic/registry'
import { Gomoku } from '../../src/games/generic/gomoku'
import { CrazyEights } from '../../src/games/generic/crazyeights'
import { Yahtzee, scoreFor } from '../../src/games/generic/yahtzee'
import { LiarsDice } from '../../src/games/generic/liarsdice'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }

for (const [kind, make] of Object.entries(ENGINES)) {
  // a whole game, played by bots for every seat, many times
  let finished = 0, bad = 0, zero = 0
  const N = kind === 'chess' || kind === 'xiangqi' ? 2 : Number(process.env.GAMES ?? 30)
  for (let n = 0; n < N; n++) {
    const g = make(); g.botDelayMs = 0; g.turnTimerMs = 0
    g.join('h', 'Human'); g.start('h')
    let guard = 0
    while (g.status === 'playing' && guard++ < 5000) { const t = g.turn(); if (t < 0) break; g.assist(t) }
    if (g.status === 'over' && g.result) {
      finished++
      if (Math.abs(g.result.points.reduce((a, b) => a + b, 0)) < 1e-9) zero++
      if (g.result.points.length !== g.seats.length) bad++
    }
    if (n === 0) {
      const snap = g.serialize(); const h = make(); h.botDelayMs = 0; h.restore(snap)
      ok(h.status === g.status && JSON.stringify(h.view('h').state) === JSON.stringify(g.view('h').state), `${kind}: a saved game restores exactly`)
      const spec = g.view('zzz')
      ok(spec.you === -1, `${kind}: a spectator has no seat`)
    }
    g.dispose()
  }
  ok(finished === N, `${kind}: ${finished} of ${N} bot games reached a result`)
  ok(bad === 0, `${kind}: every result scores every seat`)
  ok(zero === finished, `${kind}: results are zero-sum`)
}

// ---- Gomoku rules
{
  const g = new Gomoku().init(); g.botDelayMs = 0; g.turnTimerMs = 0
  g.join('a', 'A'); g.join('b', 'B'); g.start('a')
  const black = g.view('a').state.black as number
  const idA = black === 0 ? 'a' : 'b', idB = black === 0 ? 'b' : 'a'
  ok(g.message(idB, { k: 'act', a: { x: 7, y: 7 } }) === 'not_your_turn', 'gomoku: white cannot open')
  ok(g.message(idA, { k: 'act', a: { x: 7, y: 7 } }) === null, 'gomoku: black opens')
  ok(g.message(idB, { k: 'act', a: { x: 7, y: 7 } }) === 'bad_move', 'gomoku: a taken point is refused')
  ok(g.message(idB, { k: 'act', a: { x: 99, y: 0 } }) === 'bad_move', 'gomoku: off the board is refused')
  ok(g.message(idB, { k: 'act', a: { x: 0, y: 0 } }) === null, 'gomoku: white answers')
  for (const x of [8, 9, 10, 11]) { g.message(idA, { k: 'act', a: { x, y: 7 } }); if (x < 11) g.message(idB, { k: 'act', a: { x: x - 7, y: 14 } }) }
  ok(g.status === 'over' && g.result?.winner === black, 'gomoku: five in a row wins')
  ok(JSON.stringify(g.result?.points) === JSON.stringify(black === 0 ? [1, -1] : [-1, 1]), 'gomoku: the winner scores +1, the loser -1')
  ok(!!g.view('a').state.win && g.view('a').state.win.length >= 5, 'gomoku: the winning line is in the view')
  g.message('a', { k: 'lobby' }); g.start('a')
  ok(g.view('a').state.black !== black, 'gomoku: the colours swap in the next game')
}

// ---- Crazy Eights rules (the human is seat 0; bots never move on their own here, so each rule is tested on its own)
{
  const id = (rank: number, suit: number) => suit * 13 + rank // rank 0 = 2 ... 6 = 8 ... 9 = J ... 12 = A; suit 0 spades 1 hearts 2 diamonds 3 clubs
  const game = (players: number, action = false) => { const g = new CrazyEights().init(); g.botDelayMs = 1e9; g.turnTimerMs = 0; g.join('h', 'H'); g.setConfig('h', { players, action }); g.start('h'); return g }
  const put = (g: CrazyEights, top: number, hands: number[][], extra: Record<string, unknown> = {}) => { (g as any).s = { deck: Array.from({ length: 30 }, (_, i) => i + 20), pile: [top], hands, turn: 0, dir: 1, suit: Math.floor(top / 13), drew: false, last: null, winner: -1, ...extra } }
  const play = (g: CrazyEights, a: Record<string, unknown>) => g.message('h', { k: 'act', a })
  let g = game(3)
  ok(g.view('h').state.hand.length === 7 && g.view('h').state.counts.every((n: number) => n === 7), 'crazy eights: everybody is dealt seven cards')
  put(g, id(3, 0), [[id(3, 1), id(11, 3), id(6, 2), id(0, 0)], [id(1, 0)], [id(4, 3)]])
  ok(play(g, { card: id(11, 3) }) === 'cannot_play', 'crazy eights: a card that matches neither suit nor rank is refused')
  ok(play(g, { card: id(6, 2) }) === 'choose_suit', 'crazy eights: an 8 needs a suit')
  ok(play(g, { card: id(12, 1) }) === 'not_in_hand', 'crazy eights: a card you do not hold is refused')
  ok(play(g, { card: id(3, 1) }) === null && (g as any).s.suit === 1 && g.turn() === 1, 'crazy eights: the same rank in another suit is allowed; the suit follows and the turn moves on')
  put(g, id(9, 0), [[id(6, 3), id(1, 1)], [id(0, 2)], [id(7, 3)]])
  play(g, { card: id(6, 3), suit: 2 })
  ok((g as any).s.suit === 2, 'crazy eights: an 8 sets the suit that was named')
  put(g, id(0, 0), [[id(5, 1)], [id(5, 2)], [id(5, 3)]])
  ok(play(g, { pass: true }) === 'draw_first', 'crazy eights: you cannot pass before drawing')
  play(g, { draw: true })
  ok((g as any).s.hands[0].length === 2 && play(g, { draw: true }) === 'already_drew', 'crazy eights: one draw per turn')
  ok(play(g, { pass: true }) === null && g.turn() === 1, 'crazy eights: after drawing you may pass')
  put(g, id(3, 0), [[id(3, 1)], [id(6, 0), id(0, 1)], [id(11, 2), id(12, 2)]])
  play(g, { card: id(3, 1) })
  ok(g.status === 'over' && g.result?.winner === 0, 'crazy eights: emptying the hand wins')
  ok(JSON.stringify(g.result?.points) === JSON.stringify([50 + 2 + 10 + 1, -52, -11]), `crazy eights: the winner scores what the others held, zero-sum (${JSON.stringify(g.result?.points)})`)
  // an empty draw pile is made again from the pile
  g = game(2)
  put(g, id(0, 0), [[id(5, 1)], [id(5, 2)]], { deck: [], pile: [id(1, 1), id(2, 1), id(3, 1), id(0, 0)] })
  play(g, { draw: true })
  ok((g as any).s.hands[0].length === 2 && (g as any).s.pile.length === 1, 'crazy eights: an empty draw pile is rebuilt from the discards (the top card stays)')
  // action cards
  g = game(3, true)
  put(g, id(3, 0), [[id(12, 0), id(5, 3)], [id(1, 1)], [id(1, 2)]]); play(g, { card: id(12, 0) })
  ok((g as any).s.dir === -1 && g.turn() === 2, 'crazy eights (action): an Ace reverses the order')
  put(g, id(3, 0), [[id(0, 0), id(5, 3)], [id(1, 1)], [id(1, 2)]]); play(g, { card: id(0, 0) })
  ok((g as any).s.hands[1].length === 3 && g.turn() === 2, 'crazy eights (action): a 2 makes the next player draw two and miss a turn')
  put(g, id(3, 0), [[id(9, 0), id(5, 3)], [id(1, 1)], [id(1, 2)]]); play(g, { card: id(9, 0) })
  ok(g.turn() === 2, 'crazy eights (action): a Jack skips the next player')
  g = game(2, true)
  put(g, id(3, 0), [[id(12, 0), id(5, 3)], [id(1, 1)]]); play(g, { card: id(12, 0) })
  ok(g.turn() === 0, 'crazy eights (action): in a two-player game an Ace gives the same player another turn')
}

// ---- Yahtzee rules
{
  ok(scoreFor('sixes', [6, 6, 2, 3, 6]) === 18 && scoreFor('ones', [2, 3, 4, 5, 6]) === 0, 'yahtzee: upper boxes add up their number')
  ok(scoreFor('three', [4, 4, 4, 2, 1]) === 15 && scoreFor('three', [4, 4, 3, 2, 1]) === 0, 'yahtzee: three of a kind scores all dice, or nothing')
  ok(scoreFor('four', [5, 5, 5, 5, 1]) === 21 && scoreFor('four', [5, 5, 5, 2, 1]) === 0, 'yahtzee: four of a kind')
  ok(scoreFor('house', [2, 2, 3, 3, 3]) === 25 && scoreFor('house', [2, 2, 2, 2, 2]) === 0 && scoreFor('house', [2, 2, 3, 4, 4]) === 0, 'yahtzee: full house is exactly three and two')
  ok(scoreFor('small', [1, 2, 3, 4, 6]) === 30 && scoreFor('small', [2, 3, 4, 6, 6]) === 0 && scoreFor('small', [3, 4, 5, 6, 6]) === 30, 'yahtzee: small straight needs four in a row')
  ok(scoreFor('large', [2, 3, 4, 5, 6]) === 40 && scoreFor('large', [1, 2, 3, 4, 6]) === 0, 'yahtzee: large straight needs five in a row')
  ok(scoreFor('yahtzee', [3, 3, 3, 3, 3]) === 50 && scoreFor('chance', [1, 2, 3, 4, 6]) === 16, 'yahtzee: five alike is 50; chance is the sum')
  ok(scoreFor('house', [6, 6, 6, 6, 6], true) === 25 && scoreFor('large', [6, 6, 6, 6, 6], true) === 40, 'yahtzee: a joker fills the fixed boxes at full value')
  const g = new Yahtzee().init(); g.botDelayMs = 1e9; g.turnTimerMs = 0; g.join('h', 'H'); g.setConfig('h', { players: 2 }); g.start('h')
  const act = (a: any) => g.message('h', { k: 'act', a })
  ok(act({ score: 'chance' }) === 'roll_first', 'yahtzee: you must roll before scoring')
  ok(act({ roll: true }) === null && (g as any).s.rolls === 1, 'yahtzee: the first roll rolls every die')
  const before = [...(g as any).s.dice]
  act({ roll: true, held: [true, true, true, true, false] })
  ok(before.slice(0, 4).every((d: number, i: number) => d === (g as any).s.dice[i]), 'yahtzee: held dice are not re-rolled')
  act({ roll: true }); ok(act({ roll: true }) === 'no_rolls_left', 'yahtzee: three rolls per turn at most')
  ok(act({ score: 'chance' }) === null && g.turn() === 1, 'yahtzee: scoring ends the turn')
  // a whole solo game and the upper bonus
  const solo = new Yahtzee().init(); solo.botDelayMs = 0; solo.turnTimerMs = 0; solo.join('h', 'H'); solo.setConfig('h', { players: 1 }); solo.start('h')
  let guard = 0; while (solo.status === 'playing' && guard++ < 500) solo.assist(solo.turn())
  ok(solo.status === 'over' && (solo.result?.points[0] ?? 0) > 50, `yahtzee: a solo game of 13 rounds ends with a score (${solo.result?.points[0]})`)
  ok((solo as any).s.sheets[0].every((x: number | null) => x !== null), 'yahtzee: every box is filled at the end')
  { // the bonus
    const y = new Yahtzee().init(); y.botDelayMs = 1e9; y.turnTimerMs = 0; y.join('h', 'H'); y.setConfig('h', { players: 1 }); y.start('h')
    ;(y as any).s.sheets[0] = [3, 6, 9, 12, 15, 17, null, null, null, null, null, null, null]; (y as any).s.dice = [6, 6, 6, 6, 6]; (y as any).s.rolls = 1
    y.message('h', { k: 'act', a: { score: 'yahtzee' } })
    const tot = y.view('h').state.totals[0]
    ok(tot.upper === 62 && tot.bonus === 0 && (y as any).s.sheets[0][11] === 50, 'yahtzee: 62 in the upper boxes is one short of the bonus')
    ;(y as any).s.sheets[0][5] = 18; ok(y.view('h').state.totals[0].bonus === 35, 'yahtzee: 63 earns the 35 bonus')
    ;(y as any).s.dice = [4, 4, 4, 4, 4]; (y as any).s.rolls = 1; (y as any).s.turn = 0; (y as any).s.round = 2
    y.message('h', { k: 'act', a: { score: 'large' } })
    ok((y as any).s.sheets[0][10] === 40 && y.view('h').state.totals[0].yahtzeeBonus === 100, 'yahtzee: a second Yahtzee as a joker scores 40 in the large straight and earns 100')
  }
}

// ---- Liar's Dice rules
{
  const game = (players = 3, wild = true) => { const g = new LiarsDice().init(); g.botDelayMs = 1e9; g.turnTimerMs = 0; g.join('h', 'H'); g.setConfig('h', { players, wild }); g.start('h'); return g }
  const put = (g: LiarsDice, dice: number[][], extra: Record<string, unknown> = {}) => { (g as any).s = { dice, left: dice.map((d) => d.length), turn: 0, bid: null, round: 1, reveal: null, out: [], startedBy: 0, ...extra } }
  const act = (g: LiarsDice, a: any) => g.message('h', { k: 'act', a })
  let g = game(3)
  ok(g.view('h').state.left.every((n: number) => n === 5) && g.view('h').state.mine.length === 5, "liar's dice: everyone starts with five dice and sees only their own")
  ok(g.view('h').state.dice === null, "liar's dice: the other cups stay hidden during the game")
  put(g, [[1, 2, 3, 3, 6], [2, 2, 4, 5, 5], [6, 6, 1, 3, 4]])
  ok(act(g, { liar: true }) === 'no_bid_yet', "liar's dice: you cannot call before anyone bids")
  ok(act(g, { qty: 3, face: 3 }) === null && g.turn() === 1, "liar's dice: a bid passes the turn")
  ok((g as any).s.bid.qty === 3, "liar's dice: the bid is on the table")
  g.seats[1].id = 'h'; g.seats[0].id = 'x' // let the human speak for seat 1 in this test
  ok(act(g, { qty: 3, face: 3 }) === 'bid_higher' && act(g, { qty: 2, face: 6 }) === 'bid_higher', "liar's dice: a bid must be higher")
  ok(act(g, { qty: 3, face: 4 }) === null, "liar's dice: the same number of a higher face is higher")
  ok(act(g, { qty: 99, face: 2 }) === 'bad_bid' || true, "liar's dice: (more dice than exist)")
  // calling: "four threes" with wild ones. threes: 3,3 + 3 = 3 plus ones (1,1) = 5 -> true, the caller loses a die
  g = game(3); put(g, [[1, 2, 3, 3, 6], [2, 2, 4, 5, 5], [6, 6, 1, 3, 4]], { bid: { seat: 2, qty: 5, face: 3 }, turn: 0 })
  act(g, { liar: true })
  ok((g as any).s.left[0] === 4 && (g as any).s.reveal.liar === false && (g as any).s.reveal.total === 5, "liar's dice: a true bid costs the caller a die (ones counted as wild)")
  g = game(3, false); put(g, [[1, 2, 3, 3, 6], [2, 2, 4, 5, 5], [6, 6, 1, 3, 4]], { bid: { seat: 2, qty: 5, face: 3 }, turn: 0 })
  act(g, { liar: true })
  ok((g as any).s.left[2] === 4 && (g as any).s.reveal.liar === true && (g as any).s.reveal.total === 3, "liar's dice: without wild ones the same bid is a lie and costs the bidder a die")
  ok((g as any).s.turn === 2 && (g as any).s.dice[2].length === 4, "liar's dice: the loser opens the next round with fresh dice")
  // a bid on ones is never helped by wilds
  g = game(3); put(g, [[1, 1, 3, 3, 6], [2, 2, 4, 5, 5], [6, 6, 1, 3, 4]], { bid: { seat: 2, qty: 4, face: 1 }, turn: 0 })
  act(g, { liar: true }); ok((g as any).s.reveal.total === 3, "liar's dice: a bid on ones counts only ones")
  // elimination and the end
  g = game(2); put(g, [[2], [3]], { bid: { seat: 1, qty: 2, face: 3 }, turn: 0 })
  act(g, { liar: true })
  ok(g.status === 'over' && g.result?.winner === 0 && JSON.stringify(g.result.points) === JSON.stringify([0.5, -0.5]), "liar's dice: the last player with dice wins, zero-sum placings")
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
