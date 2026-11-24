// Run: npx tsx scripts/generic/engine-test.ts   Every turn-based game on the shared frame: lobby, bots, full games to a result, persistence, rules.
import { ENGINES } from '../../src/games/generic/registry'
import { Gomoku } from '../../src/games/generic/gomoku'
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
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
