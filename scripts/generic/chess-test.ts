// Run: npx tsx scripts/generic/chess-test.ts   The chess rules against the published perft node counts (every legal-move path to a depth), plus ends of games and the computer opponent.
import { bestMove, ending, fromFen, inCheck, key, legal, parseSq, perft, play, san, startPos, toFen, START_FEN } from '../../src/games/generic/chessrules'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }

const PERFT: [string, string, number[]][] = [
  ['start position', START_FEN, [20, 400, 8902, 197281]],
  ['kiwipete (castling, pins, en passant)', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['endgame with en passant checks', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['promotions and castling rights', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['promotion into check', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
]
for (const [label, fen, counts] of PERFT) {
  const p = fromFen(fen)
  ok(toFen(p) === fen || toFen(p).split(' ').slice(0, 4).join(' ') === fen.split(' ').slice(0, 4).join(' '), `${label}: the position reads and writes back`)
  counts.forEach((want, i) => { const got = perft(p, i + 1); ok(got === want, `${label}: perft(${i + 1}) = ${got} (should be ${want})`) })
}

// ends of games
const mv = (p: ReturnType<typeof startPos>, from: string, to: string, promo?: number) => { const m = legal(p).find((x) => x.from === parseSq(from) && x.to === parseSq(to) && (promo === undefined || x.promo === promo)); if (!m) throw new Error(`illegal ${from}${to} in ${toFen(p)}`); return play(p, m) }
{
  let p = startPos(); const keys = [key(p)]
  for (const [a, b] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) { p = mv(p, a, b); keys.push(key(p)) }
  const e = ending(p, keys)
  ok(e.over && e.result === 'mate' && e.winner === -1, "fool's mate is checkmate for black")
  ok(san(fromFen('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2'), legal(fromFen('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2')).find((m) => m.from === parseSq('d8') && m.to === parseSq('h4'))!) === 'Qh4#', 'the move text shows mate (Qh4#)')
}
{ const p = fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); const e = ending(p, []); ok(e.over && e.result === 'stalemate', 'stalemate is a draw') }
{ const p = fromFen('8/8/8/4k3/8/8/8/4K2N w - - 0 1'); const e = ending(p, []); ok(e.over && e.result === 'insufficient', 'king and knight against king cannot win') }
{ const p = fromFen('8/8/8/4k3/8/8/4P3/4K3 w - - 100 80'); const e = ending(p, []); ok(e.over && e.result === 'fifty', 'fifty moves without a pawn move or capture is a draw') }
{ let p = fromFen('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1'); ok(legal(p).some((m) => m.castle === 'Q'), 'castling is offered with a clear path'); p = fromFen('4k3/8/8/8/8/8/8/R3K2r w Q - 0 1'); ok(!legal(p).some((m) => m.castle), 'but not when the king is in check'); p = fromFen('4k3/8/8/8/8/5r2/8/4K2R w K - 0 1'); ok(!legal(p).some((m) => m.castle === 'K'), 'nor through an attacked square') }
{ let p = fromFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'); ok(legal(p).some((m) => m.ep), 'en passant is available right after the double step'); p = mv(p, 'e5', 'd6'); ok(p.b[parseSq('d5')] === 0, 'and removes the pawn that moved past') }
{ const p = fromFen('8/P6k/8/8/8/8/8/K7 w - - 0 1'); ok(legal(p).filter((m) => m.from === parseSq('a7')).length === 4, 'a pawn on the last step but one promotes to four pieces') }
{ const p = fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1'); ok(inCheck(p) && legal(p).every((m) => m.from === parseSq('e1')), 'in check only the king (or a block/capture) may move') }

// the computer
{
  let p = fromFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1')
  const m = bestMove(p, 2, 0)!; ok(m.from === parseSq('d1') && m.to === parseSq('d8'), 'the computer finds a back-rank mate in one')
  p = fromFen('4k3/8/8/8/8/8/3q4/4K1R1 w - - 0 1')
  const t0 = Date.now(); const m2 = bestMove(p, 2, 0)!; ok(!!m2, `the computer answers a middlegame position (${Date.now() - t0} ms)`)
  // games between computers finish and never make an illegal move
  let done = 0
  for (let g = 0; g < 4; g++) {
    let q = startPos(); const keys = [key(q)]; let end = ending(q, keys), plies = 0
    while (!end.over && plies < 300) { const mm = bestMove(q, 1, 40)!; q = play(q, mm); keys.push(key(q)); end = ending(q, keys); plies++ }
    if (end.over || plies >= 300) done++
  }
  ok(done === 4, `${done} of 4 computer games finished without an illegal move`)
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
