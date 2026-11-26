import { TurnGame, type GameMeta, type Outcome } from '../frame/base'

/** Reversi on 8 x 8: place a disc so that it brackets a row of the other colour, which then flips. No legal move: pass. Most discs at the end wins. */
export const REVERSI_META: GameMeta = {
  kind: 'reversi',
  minPlayers: 2,
  maxPlayers: 2,
  variable: false,
  chipUnit: 400,
  fields: [
    {
      key: 'level',
      label: 'chLevel',
      options: [
        ['easy', 'chEasy'],
        ['normal', 'chNormal'],
        ['hard', 'chHard'],
      ],
    },
  ],
  defaults: { level: 'normal', ranked: false },
}
const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
/** how much each square is worth: corners are gold, the squares next to them are traps */
const W = [
  100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, 1, 1, 1, 1, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5, 5, -2, 1, 0, 0, 1, -2, 5, 10, -2,
  1, 1, 1, 1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100,
]

/** the squares a disc of `who` (1 or 2) flips when placed at (x, y); empty when the move is not legal */
export function flips(board: number[], x: number, y: number, who: number): number[] {
  if (x < 0 || y < 0 || x > 7 || y > 7 || board[y * 8 + x] !== 0) return []
  const out: number[] = []
  for (const [dx, dy] of DIRS) {
    const run: number[] = []
    let cx = x + dx,
      cy = y + dy
    while (cx >= 0 && cy >= 0 && cx < 8 && cy < 8 && board[cy * 8 + cx] === 3 - who) {
      run.push(cy * 8 + cx)
      cx += dx
      cy += dy
    }
    if (run.length && cx >= 0 && cy >= 0 && cx < 8 && cy < 8 && board[cy * 8 + cx] === who) out.push(...run)
  }
  return out
}
export function legal(board: number[], who: number): number[] {
  const out: number[] = []
  for (let i = 0; i < 64; i++) if (board[i] === 0 && flips(board, i % 8, Math.floor(i / 8), who).length) out.push(i)
  return out
}

interface State {
  board: number[]
  black: number
  turn: number
  last: number
  passed: boolean
  over: boolean
  moves: number
}

export class Reversi extends TurnGame {
  readonly meta = REVERSI_META
  private s: State = { board: [], black: 0, turn: 0, last: -1, passed: false, over: false, moves: 0 }
  private colour(seat: number) {
    return seat === this.s.black ? 1 : 2
  }
  protected begin() {
    const board = Array(64).fill(0)
    board[27] = 2
    board[36] = 2
    board[28] = 1
    board[35] = 1
    const black = (this.gameNo - 1) % 2 // colours swap every game
    this.s = { board, black, turn: black, last: -1, passed: false, over: false, moves: 0 }
  }
  turn() {
    return this.status === 'playing' && !this.s.over ? this.s.turn : -1
  }
  protected act(seat: number, m: any): string | null {
    const x = Number(m?.x),
      y = Number(m?.y)
    if (!Number.isInteger(x) || !Number.isInteger(y) || !flips(this.s.board, x, y, this.colour(seat)).length) return 'bad_move'
    this.play(seat, y * 8 + x)
    return null
  }
  private play(seat: number, at: number) {
    const who = this.colour(seat)
    const f = flips(this.s.board, at % 8, Math.floor(at / 8), who)
    this.s.board[at] = who
    for (const i of f) this.s.board[i] = who
    this.s.last = at
    this.s.moves++
    this.advance(seat)
  }
  /** hand the turn over; a player with no move is skipped, and when nobody can move the game ends */
  private advance(seat: number) {
    const other = 1 - seat
    if (legal(this.s.board, this.colour(other)).length) {
      this.s.turn = other
      this.s.passed = false
      return
    }
    if (legal(this.s.board, this.colour(seat)).length) {
      this.s.turn = seat
      this.s.passed = true
      return
    } // the other side passes
    this.s.over = true
  }
  // ---- the bot ----
  protected bot(seat: number) {
    const who = this.colour(seat),
      mine = legal(this.s.board, who)
    if (!mine.length) {
      this.advance(1 - seat)
      return
    }
    const level = this.config.level
    let pick: number
    if (level === 'easy') pick = mine[Math.floor(Math.random() * mine.length)]
    else {
      const depth = level === 'hard' ? 4 : 2
      let best = -Infinity,
        picks: number[] = []
      for (const m of mine) {
        const b = this.s.board.slice()
        b[m] = who
        for (const i of flips(this.s.board, m % 8, Math.floor(m / 8), who)) b[i] = who
        const v = -this.search(b, 3 - who, depth - 1, -Infinity, Infinity, who)
        if (v > best + 0.01) {
          best = v
          picks = [m]
        } else if (Math.abs(v - best) <= 0.01) picks.push(m)
      }
      pick = picks[Math.floor(Math.random() * picks.length)]
    }
    this.play(seat, pick)
  }
  /** negamax with alpha-beta; the value is from the point of view of `side`, who is about to move */
  private search(b: number[], side: number, depth: number, alpha: number, beta: number, root: number): number {
    const moves = legal(b, side)
    if (depth === 0 || (!moves.length && !legal(b, 3 - side).length)) return this.evaluate(b, side)
    if (!moves.length) return -this.search(b, 3 - side, depth - 1, -beta, -alpha, root)
    let best = -Infinity
    for (const m of moves) {
      const nb = b.slice()
      nb[m] = side
      for (const i of flips(b, m % 8, Math.floor(m / 8), side)) nb[i] = side
      const v = -this.search(nb, 3 - side, depth - 1, -beta, -alpha, root)
      if (v > best) best = v
      if (best > alpha) alpha = best
      if (alpha >= beta) break
    }
    return best
  }
  private evaluate(b: number[], side: number): number {
    let pos = 0,
      mine = 0,
      theirs = 0
    for (let i = 0; i < 64; i++) {
      if (b[i] === side) {
        pos += W[i]
        mine++
      } else if (b[i]) {
        pos -= W[i]
        theirs++
      }
    }
    const mob = legal(b, side).length - legal(b, 3 - side).length
    const empties = 64 - mine - theirs
    return empties < 10 ? (mine - theirs) * 8 + pos * 0.3 : pos + mob * 6
  }

  protected gameView() {
    const b = this.s.board
    return {
      board: b,
      black: this.s.black,
      last: this.s.last,
      passed: this.s.passed,
      counts: [b.filter((c) => c === 1).length, b.filter((c) => c === 2).length],
      legal: this.s.over ? [] : legal(b, this.colour(this.s.turn)),
    }
  }
  protected outcome(): Outcome | null {
    if (!this.s.over) return null
    const c1 = this.s.board.filter((c) => c === 1).length,
      c2 = this.s.board.filter((c) => c === 2).length
    if (c1 === c2) return { points: [0, 0], winner: -1 }
    const winner = (c1 > c2 ? 1 : 2) === 1 ? this.s.black : 1 - this.s.black
    return { points: winner === 0 ? [1, -1] : [-1, 1], winner }
  }
  protected saveState() {
    return this.s
  }
  protected loadState(s: State) {
    this.s = s
  }
}
