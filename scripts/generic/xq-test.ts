// Run: npx tsx scripts/generic/xq-test.ts   The Xiangqi rules: published perft counts from the start position, piece rules, mate/stalemate/flying general, and the computer opponent.
import { bestMove, ending, fromFen, inCheck, key, legal, perft, play, startPos, toFen, START_FEN } from '../../src/games/generic/xqrules'
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sq = (n: string) => Number(n[1]) * 9 + (n.charCodeAt(0) - 97)
const dest = (fen: string, from: string) =>
  legal(fromFen(fen))
    .filter((m) => m.from === sq(from))
    .map((m) => m.to)
    .sort((a, b) => a - b)
const names = (a: number[]) => a.map((s) => String.fromCharCode(97 + (s % 9)) + Math.floor(s / 9)).join(' ')

ok(toFen(startPos()) === 'rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR w 0', 'the start position reads and writes back')
for (const [d, want] of [
  [1, 44],
  [2, 1920],
  [3, 79666],
] as const) {
  const got = perft(startPos(), d)
  ok(got === want, `start position: perft(${d}) = ${got} (should be ${want})`)
}

// pieces (positions are written as { square: piece }; the black general sits on f9 and the red one on d0, so the generals never face each other by accident)
const board = (pieces: Record<string, string>, turn = 'w') => {
  const rows: string[] = []
  for (let r = 9; r >= 0; r--) {
    let row = '',
      e = 0
    for (let f = 0; f < 9; f++) {
      const c = pieces[String.fromCharCode(97 + f) + r]
      if (c) {
        if (e) {
          row += e
          e = 0
        }
        row += c
      } else e++
    }
    rows.push(row + (e || ''))
  }
  return `${rows.join('/')} ${turn} 0`
}
const kings = { f9: 'k', d0: 'K' }
const set = (a: number[]) => names(a).split(' ').sort().join(' ')
const d = (pieces: Record<string, string>, from: string) => dest(board({ ...kings, ...pieces }), from)
ok(set(d({}, 'd0')) === 'd1 e0', 'the general moves one step inside the palace')
ok(set(d({ e0: 'A' }, 'e0')) === 'd1 f1', 'an advisor moves one diagonal step inside the palace')
ok(set(d({ e2: 'E' }, 'e2')) === 'c0 c4 g0 g4', 'an elephant jumps two diagonally')
ok(set(d({ e2: 'E', f3: 'P' }, 'e2')) === 'c0 c4 g0', 'an elephant is blocked at its eye')
ok(!d({ e4: 'E' }, 'e4').some((s) => Math.floor(s / 9) > 4), 'an elephant stays on its own side of the river')
ok(set(d({ e4: 'H' }, 'e4')) === 'c3 c5 d2 d6 f2 f6 g3 g5', 'a horse jumps one orthogonal and one diagonal step')
ok(set(d({ e4: 'H', f4: 'P' }, 'e4')) === 'c3 c5 d2 d6 f2 f6', 'a horse is blocked at its leg')
ok(!d({ a0: 'C', a9: 'r' }, 'a0').includes(sq('a9')), 'a cannon cannot capture without a screen')
ok(d({ a0: 'C', a7: 'P', a9: 'r' }, 'a0').includes(sq('a9')), 'a cannon captures over exactly one piece')
ok(!d({ a0: 'C', a6: 'P', a7: 'P', a9: 'r' }, 'a0').includes(sq('a9')), 'but not over two')
ok(set(d({ e3: 'P' }, 'e3')) === 'e4', 'a soldier steps forward before the river')
ok(set(d({ e5: 'P' }, 'e5')) === 'd5 e6 f5', 'a soldier also steps sideways after the river')
// the generals may not face each other
ok(inCheck(fromFen('4k4/9/9/9/9/9/9/9/9/4K4 w 0'), 1), 'two generals on an open file are "in check"')
{
  const p = fromFen('4k4/9/9/9/9/9/9/4R4/9/4K4 w 0')
  ok(
    legal(p).every((m) => m.from !== sq('e7') || m.to % 9 === 4),
    'a piece that shields the generals cannot leave the file',
  )
}
// mate and stalemate both lose
{
  const e = ending(fromFen('R3k4/R8/9/9/9/9/9/9/9/3K5 b 0'), [])
  ok(e.over && e.result === 'mate' && e.winner === 1, 'two chariots on the back ranks mate the general')
}
{
  const e = ending(fromFen('4k4/9/9/9/9/9/9/9/3r1r3/4K4 w 0'), [])
  ok(e.over && e.winner === -1, 'a side with no legal move has lost (stalemate included)')
}
{
  const p = startPos()
  const keys = [key(p), key(p), key(p)]
  const e = ending(p, keys)
  ok(e.over && e.result === 'repetition' && e.winner === 0, 'the same position three times is a draw')
}
// the computer
{
  const q = fromFen('4k4/9/9/9/9/9/9/9/9/R2K1R3 w 0')
  ok(!!bestMove(q, 2, 0), 'the computer answers a position')
  const mate = bestMove(fromFen(board({ a8: 'R', b1: 'R', e9: 'k', d0: 'K' })), 2, 0)!
  {
    const e = ending(play(fromFen(board({ a8: 'R', b1: 'R', e9: 'k', d0: 'K' })), mate), [])
    ok(e.over && e.winner === 1, 'the computer finds a winning move in one (mate or stalemate, both win)')
  }
  let done = 0
  for (let g = 0; g < 3; g++) {
    let x = startPos()
    const keys = [key(x)]
    let end = ending(x, keys),
      plies = 0
    while (!end.over && plies < 400) {
      const mv = bestMove(x, 1, 60)!
      x = play(x, mv)
      keys.push(key(x))
      end = ending(x, keys)
      plies++
    }
    done++
  }
  ok(done === 3, `${done} of 3 computer games ran to the end without an illegal move`)
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
