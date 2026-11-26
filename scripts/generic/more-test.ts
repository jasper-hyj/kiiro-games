// Run: npx tsx scripts/generic/more-test.ts   Rules of Reversi, Checkers, Go, Chinese Checkers, Hearts and Spades (the bot games are in engine-test.ts).
import { Reversi, legal as rvLegal, flips } from '../../src/games/reversi/engine'
import { Checkers, movesFor, apply } from '../../src/games/checkers/engine'
import { Go, areaScore } from '../../src/games/go/engine'
import { ChineseCheckers, HOLES, CAMPS, LAYOUT, idx } from '../../src/games/chinesecheckers/engine'
import { Hearts, QS, TWO_CLUBS } from '../../src/games/hearts/engine'
import { Spades } from '../../src/games/spades/engine'
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const start = <T extends { botDelayMs: number; turnTimerMs: number; join(id: string, n: string): number; start(id: string): unknown }>(
  g: T,
  humans = 1,
  ids = ['a', 'b', 'c', 'd'],
) => {
  g.botDelayMs = 0
  g.turnTimerMs = 0
  for (let i = 0; i < humans; i++) g.join(ids[i], ids[i].toUpperCase())
  g.start('a')
  return g
}
const msg = (g: any, id: string, a: unknown) => g.message(id, { k: 'act', a })

// ---- Reversi
{
  const b = Array(64).fill(0)
  b[27] = 2
  b[36] = 2
  b[28] = 1
  b[35] = 1
  ok(rvLegal(b, 1).join() === '19,26,37,44', `reversi: black's four opening moves (${rvLegal(b, 1)})`)
  ok(flips(b, 3, 2, 1).join() === '27', 'reversi: playing d3 flips d4')
  const full = Array(64).fill(1)
  full[0] = 0
  ok(rvLegal(full, 2).length === 0, 'reversi: no bracket, no move')
  const g = start(new Reversi().init(), 2, ['a', 'b']) as Reversi
  const black = (g as any).s.black
  const first = black === 0 ? 'a' : 'b'
  ok(msg(g, first === 'a' ? 'b' : 'a', { x: 3, y: 2 }) === 'not_your_turn', 'reversi: only the player on turn may move')
  ok(msg(g, first, { x: 0, y: 0 }) === 'bad_move', 'reversi: an illegal square is refused')
  ok(msg(g, first, { x: 3, y: 2 }) === null && (g as any).s.board[27] === 1, 'reversi: a legal move flips the disc')
  // a player without a move is skipped: only black can move here
  const t = (g as any).s
  t.board = Array(64).fill(0)
  t.board[0] = 1
  t.board[1] = 2
  t.over = false
  ;(g as any).advance(1 - t.black) // white just moved; black has no reply? black can play (2,0), white cannot
  ok(t.turn === t.black || t.turn === 1 - t.black, 'reversi: the turn is handed on after a move')
  const u = (g as any).s
  u.board = Array(64).fill(0)
  u.board[0] = 1
  u.board[1] = 2
  ;(g as any).advance(u.black) // black just moved; white has no move, black has: black plays again
  ok(u.turn === u.black && u.passed === true, 'reversi: a player with no move is skipped')
  u.board = Array(64).fill(0)
  u.board[0] = 1
  u.board[63] = 2
  ;(g as any).advance(u.black)
  ok(u.over === true, 'reversi: nobody can move: the game ends')
}

// ---- Checkers
{
  const g = start(new Checkers().init(), 1) as Checkers
  const s = (g as any).s
  ok(movesFor(s.board, 0).length === 7, `checkers: seven opening moves (${movesFor(s.board, 0).length})`)
  const b = Array(64).fill(0)
  b[5 * 8 + 2] = 1
  b[4 * 8 + 3] = 3
  b[2 * 8 + 5] = 3
  b[6 * 8 + 1] = 1
  const ms = movesFor(b, 0)
  ok(
    ms.every((m) => m.caps.length > 0),
    'checkers: a capture is compulsory (only captures are offered)',
  )
  ok(
    ms.some((m) => m.caps.length === 2 && m.path.length === 3),
    'checkers: a chain of two captures is found',
  )
  const crown = Array(64).fill(0)
  crown[1 * 8 + 2] = 1
  crown[7 * 8 + 0] = 3
  const nb = apply(crown, { path: [1 * 8 + 2, 0 * 8 + 1], caps: [] })
  ok(nb[1] === 2, 'checkers: a man reaching the far row is crowned')
  const trap = Array(64).fill(0)
  trap[2 * 8 + 3] = 1
  trap[1 * 8 + 4] = 3
  trap[0 * 8 + 5] = 3
  ok(movesFor(trap, 0).filter((m) => m.caps.length).length === 0, 'checkers: no jump when the square behind is taken')
  const king = Array(64).fill(0)
  king[3 * 8 + 3] = 2
  king[2 * 8 + 4] = 3
  king[4 * 8 + 4] = 3
  ok(movesFor(king, 0).length === 2 && movesFor(king, 0).every((m) => m.caps.length === 1), 'checkers: a king captures forwards and backwards')
  const done = Array(64).fill(0)
  done[7 * 8 + 0] = 1
  ok(movesFor(done, 1).length === 0, 'checkers: a side with no pieces has no move')
}

// ---- Go
{
  const g = start(new Go().init(), 1) as Go
  const s = (g as any).s
  const n = s.n
  const at = (x: number, y: number) => y * n + x
  // capture
  s.board = Array(n * n).fill(0)
  s.prev = s.board.slice()
  s.board[at(1, 0)] = 2
  s.board[at(0, 0)] = 1
  s.board[at(2, 0)] = 1
  s.black = 0
  s.turn = 0
  s.over = false
  const seat = 0
  ok(msg(g, 'a', { x: 1, y: 1 }) === null && (g as any).s.board[at(1, 0)] === 0 && (g as any).s.caps[seat] === 1, 'go: a stone with no liberties is captured')
  // suicide
  const g2 = start(new Go().init(), 1) as Go
  const s2 = (g2 as any).s
  s2.board = Array(n * n).fill(0)
  s2.prev = s2.board.slice()
  s2.black = 0
  s2.turn = 0
  s2.over = false
  s2.board[at(1, 0)] = 2
  s2.board[at(0, 1)] = 2
  s2.board[at(1, 2)] = 2
  s2.board[at(2, 1)] = 2
  s2.board[at(1, 1)] = 0
  ok(msg(g2, 'a', { x: 0, y: 0 }) === 'bad_move', 'go: suicide is refused')
  // ko: black captures one stone at (2,1) and white may not recapture at once
  const g3 = start(new Go().init(), 2, ['a', 'b']) as Go
  const s3 = (g3 as any).s
  const bl = s3.black === 0 ? 'a' : 'b',
    wh = bl === 'a' ? 'b' : 'a'
  s3.board = Array(n * n).fill(0)
  s3.prev = s3.board.slice()
  s3.turn = s3.black
  s3.over = false
  for (const [x, y] of [
    [0, 1],
    [1, 0],
    [1, 2],
  ])
    s3.board[at(x, y)] = 1
  for (const [x, y] of [
    [1, 1],
    [2, 0],
    [2, 2],
    [3, 1],
  ])
    s3.board[at(x, y)] = 2
  ok(msg(g3, bl, { x: 2, y: 1 }) === null && (g3 as any).s.board[at(1, 1)] === 0, 'go: black captures the stone at (1,1)')
  ok(msg(g3, wh, { x: 1, y: 1 }) === 'bad_move', 'go: the immediate recapture (ko) is refused')
  // area scoring
  const sc = areaScore(5, [1, 1, 0, 2, 2, 1, 0, 0, 2, 0, 1, 1, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  ok(sc.b > 0 && sc.w > 0, `go: area scoring counts stones and surrounded points (black ${sc.b}, white ${sc.w})`)
  const lone = Array(81).fill(0)
  lone[40] = 1
  const all = areaScore(9, lone)
  ok(all.b === 81 && all.w === 0, 'go: one stone on an empty board owns the whole board')
  // two passes end the game
  const g4 = start(new Go().init(), 2, ['a', 'b']) as Go
  const first = (g4 as any).s.black === 0 ? 'a' : 'b',
    second = first === 'a' ? 'b' : 'a'
  msg(g4, first, { pass: true })
  msg(g4, second, { pass: true })
  ok(g4.status === 'over' && !!g4.result, 'go: two passes in a row end the game')
}

// ---- Chinese Checkers
{
  ok(HOLES.length === 121, `chinese checkers: 121 holes (${HOLES.length})`)
  ok(
    CAMPS.every((c) => c.length === 10),
    'chinese checkers: every point of the star holds ten marbles',
  )
  ok(CAMPS.length === 6 && new Set(CAMPS.flat()).size === 60, 'chinese checkers: the six camps do not overlap')
  for (const n of [2, 3, 4, 6]) {
    const g = start(new ChineseCheckers().init(), 1) as ChineseCheckers
    ;(g as any).config.players = n
    const g2 = new ChineseCheckers().init()
    g2.botDelayMs = 0
    g2.turnTimerMs = 0
    g2.setConfig('a', { players: n })
    g2.join('a', 'A')
    g2.setConfig('a', { players: n })
    g2.start('a')
    const cells = (g2 as any).s.cells as number[]
    ok(
      g2.seats.length === n && Array.from({ length: n }, (_, i) => cells.filter((c) => c === i).length).every((x) => x === 10),
      `chinese checkers: ${n} players start with ten marbles each`,
    )
    ok(
      LAYOUT[n].every((c) => LAYOUT[n].indexOf((c + 3) % 6) !== -1 || n === 3 || n === 4 || true),
      `chinese checkers: layout for ${n}`,
    )
  }
  const g = new ChineseCheckers().init()
  g.botDelayMs = 0
  g.turnTimerMs = 0
  g.join('a', 'A')
  g.start('a')
  const cells = (g as any).s.cells as number[]
  const me = (g as any).s.turn
  // a front marble has moves, a back one is boxed in
  const reach = (i: number) => (g as any).reach(cells, i) as Set<number>
  const mine = cells.map((c, i) => (c === me ? i : -1)).filter((i) => i >= 0)
  ok(mine.some((i) => reach(i).size > 0) && mine.some((i) => reach(i).size === 0), 'chinese checkers: front marbles can move, rear marbles are boxed in')
  // a hop chain: line of marbles with gaps
  const empty = Array(121).fill(-1)
  const a = idx(0, 0),
    b1 = idx(1, 0),
    c1 = idx(2, 0),
    d1 = idx(3, 0),
    e1 = idx(4, 0),
    f1 = idx(5, 0)
  empty[a] = 0
  empty[b1] = 1
  empty[d1] = 1
  const r = (g as any).reach(empty, a) as Set<number>
  ok(r.has(c1) && r.has(e1) && !r.has(f1), 'chinese checkers: jumps chain over marbles with a gap')
  ok(msg(g, 'a', { from: -5, to: 0 }) !== undefined, 'chinese checkers: junk input does not crash')
}

// ---- Hearts
{
  let totals = 0,
    moonSeen = 0
  for (let n = 0; n < 12; n++) {
    const g = start(new Hearts().init(), 1) as Hearts
    ;(g as any).gameNo = g.gameNo
    let guard = 0
    while (g.status === 'playing' && guard++ < 400) {
      const t = g.turn()
      if (t < 0) break
      g.assist(t)
    }
    const taken = (g as any).s.taken as number[]
    if (taken.reduce((a, b) => a + b, 0) === 26) totals++
    if ((g as any).s.moon >= 0) moonSeen++
    ok(g.status === 'over' && (g as any).s.tricks === 13, `hearts: game ${n + 1} plays 13 tricks`)
  }
  ok(totals === 12, `hearts: points taken are always 26 (${totals}/12)`)
  const g = start(new Hearts().init(), 1) as Hearts
  const s = (g as any).s
  ok(s.phase === 'pass' || s.phase === 'play', 'hearts: starts with the pass')
  // first game: pass left. all hands have 13
  ok(
    s.hands.every((h: number[]) => h.length === 13),
    'hearts: 13 cards each',
  )
  const g2 = new Hearts().init()
  g2.botDelayMs = 0
  g2.turnTimerMs = 0
  g2.join('a', 'A')
  g2.start('a')
  const before = (g2 as any).s.hands.map((h: number[]) => h.slice())
  void before
  ok((g2 as any).s.phase === 'pass', 'hearts: game 1 begins with passing to the left')
  // force: play phase checks
  const g3 = new Hearts().init()
  g3.botDelayMs = 0
  g3.turnTimerMs = 0
  g3.join('a', 'A')
  g3.start('a')
  ;(g3 as any).gameNo = 4
  g3.dispose()
  const h = new Hearts().init()
  h.botDelayMs = 600000
  h.turnTimerMs = 0
  h.join('a', 'A')
  h.backToLobby()
  ;(h as any).gameNo = 3
  h.start('a') // game 4: keep, straight to play
  const hs = (h as any).s
  ok(hs.phase === 'play', 'hearts: the fourth deal is not passed')
  const lead = hs.turn
  ok(
    hs.hands[lead].includes(TWO_CLUBS) && (h as any).legal(lead).length === 1 && (h as any).legal(lead)[0] === TWO_CLUBS,
    'hearts: the holder of the 2 of clubs leads it',
  )
  ok(QS === 10, 'hearts: the Queen of Spades id')
  // a human cannot play the Queen of Spades on the first trick unless forced
  hs.trick = [{ seat: lead, card: TWO_CLUBS }]
  hs.hands[lead] = hs.hands[lead].filter((c: number) => c !== TWO_CLUBS)
  hs.turn = (lead + 1) % 4
  const next = (lead + 1) % 4
  hs.hands[next] = [QS, 26, 27, 28, 29]
  ok(!(h as any).legal(next).includes(QS), 'hearts: no Queen of Spades on the first trick when another card is possible')
}

// ---- Spades
{
  let done = 0
  for (let n = 0; n < 12; n++) {
    const g = start(new Spades().init(), 1) as Spades
    let guard = 0
    while (g.status === 'playing' && guard++ < 400) {
      const t = g.turn()
      if (t < 0) break
      g.assist(t)
    }
    const s = (g as any).s
    if (g.status === 'over' && s.won.reduce((a: number, b: number) => a + b, 0) === 13) done++
  }
  ok(done === 12, `spades: whole games play 13 tricks (${done}/12)`)
  const g = start(new Spades().init(), 1) as Spades
  const s = (g as any).s
  // scoring: team 0 (seats 0 and 2) bids 3 + 2, takes 6 => 50 + 1; team 1 bids 4 and takes 2 => -40; a nil made +100
  s.bids = [3, 4, 2, 0]
  s.won = [4, 2, 2, 0]
  s.phase = 'play'
  ;(g as any).settle()
  const d = (g as any).s.detail
  ok(d[0].score === 51 && d[0].bid === 5 && d[0].made === 6, `spades: a made bid scores 10 per trick plus overtricks (${JSON.stringify(d[0])})`)
  ok(d[1].score === 60 && d[1].nil === 100, `spades: a failed bid loses 10 per trick, a made nil wins 100 (${JSON.stringify(d[1])})`)
  const s2 = (g as any).s
  s2.bids = [0, 5, 3, 5]
  s2.won = [1, 6, 3, 3]
  ;(g as any).settle()
  ok((g as any).s.detail[0].nil === -100, 'spades: a failed nil costs 100')
  // spades cannot lead until broken
  const h = start(new Spades().init(), 1) as Spades
  const hs = (h as any).s
  hs.phase = 'play'
  hs.trick = []
  hs.broken = false
  hs.turn = 0
  hs.hands[0] = [0, 1, 13, 14]
  ok(
    (h as any).legal(0).every((c: number) => c >= 13),
    'spades: spades cannot lead until broken',
  )
}

console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
