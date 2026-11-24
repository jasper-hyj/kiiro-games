// Run: npx tsx scripts/generic/engine-test.ts   Every turn-based game on the shared frame: lobby, bots, full games to a result, persistence, rules.
import { ENGINES } from '../../src/games/generic/registry'
import { Gomoku } from '../../src/games/generic/gomoku'
import { CrazyEights } from '../../src/games/generic/crazyeights'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }

for (const [kind, make] of Object.entries(ENGINES)) {
  // a whole game, played by bots for every seat, many times
  let finished = 0, bad = 0, zero = 0
  const N = Number(process.env.GAMES ?? 30)
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
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
