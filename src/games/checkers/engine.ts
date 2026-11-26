import { TurnGame, type GameMeta, type Outcome } from '../frame/base'

/**
 * Checkers (English draughts): 8 x 8, twelve pieces each on the dark squares. Men move one step diagonally forward, kings both ways.
 * Capturing is compulsory and may continue in a chain; a man that reaches the far row becomes a king and its move ends.
 * No legal move loses. Eighty plies without a capture or a man moving is a draw.
 */
export const CHECKERS_META: GameMeta = {
  kind: 'checkers',
  minPlayers: 2,
  maxPlayers: 2,
  variable: false,
  chipUnit: 500,
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
/** pieces: 0 empty, 1 / 2 = first player's man / king (moves up the screen), 3 / 4 = second player's man / king (moves down) */
export interface CMove {
  path: number[]
  caps: number[]
}
const side = (p: number) => (p === 0 ? -1 : p <= 2 ? 0 : 1)
const isKing = (p: number) => p === 2 || p === 4

export function movesFor(b: number[], who: number): CMove[] {
  const jumps: CMove[] = [],
    steps: CMove[] = []
  for (let from = 0; from < 64; from++) {
    const p = b[from]
    if (side(p) !== who) continue
    const fx = from % 8,
      fy = Math.floor(from / 8)
    const dirs: [number, number][] = isKing(p)
      ? [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]
      : who === 0
        ? [
            [1, -1],
            [-1, -1],
          ]
        : [
            [1, 1],
            [-1, 1],
          ]
    for (const [dx, dy] of dirs) {
      const x = fx + dx,
        y = fy + dy
      if (x >= 0 && y >= 0 && x < 8 && y < 8 && b[y * 8 + x] === 0) steps.push({ path: [from, y * 8 + x], caps: [] })
    }
    // chains of captures
    const walk = (at: number, piece: number, path: number[], caps: number[], board: number[]) => {
      const ax = at % 8,
        ay = Math.floor(at / 8)
      const ds: [number, number][] = isKing(piece)
        ? [
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
          ]
        : who === 0
          ? [
              [1, -1],
              [-1, -1],
            ]
          : [
              [1, 1],
              [-1, 1],
            ]
      let any = false
      for (const [dx, dy] of ds) {
        const mx = ax + dx,
          my = ay + dy,
          lx = ax + 2 * dx,
          ly = ay + 2 * dy
        if (lx < 0 || ly < 0 || lx > 7 || ly > 7) continue
        const mid = board[my * 8 + mx]
        if (mid === 0 || side(mid) === who || board[ly * 8 + lx] !== 0) continue
        any = true
        const nb = board.slice()
        nb[my * 8 + mx] = 0
        nb[at] = 0
        const land = ly * 8 + lx
        const crowned = !isKing(piece) && ((who === 0 && ly === 0) || (who === 1 && ly === 7))
        nb[land] = crowned ? piece + 1 : piece
        if (crowned)
          jumps.push({ path: [...path, land], caps: [...caps, my * 8 + mx] }) // crowning ends the move
        else walk(land, piece, [...path, land], [...caps, my * 8 + mx], nb)
      }
      if (!any && path.length > 1) jumps.push({ path, caps })
    }
    walk(from, p, [from], [], b)
  }
  return jumps.length ? jumps : steps
}
export function apply(b: number[], m: CMove): number[] {
  const nb = b.slice()
  const from = m.path[0],
    to = m.path[m.path.length - 1]
  let p = nb[from]
  nb[from] = 0
  for (const c of m.caps) nb[c] = 0
  const y = Math.floor(to / 8)
  if (p === 1 && y === 0) p = 2
  if (p === 3 && y === 7) p = 4
  nb[to] = p
  return nb
}

interface State {
  board: number[]
  first: number
  turn: number
  last: number[] | null
  quiet: number
  over: boolean
  winner: number
}

export class Checkers extends TurnGame {
  readonly meta = CHECKERS_META
  private s: State = { board: [], first: 0, turn: 0, last: null, quiet: 0, over: false, winner: -1 }
  /** which side (0 moves up / goes first, 1 moves down) a seat plays */
  private sideOf(seat: number) {
    return seat === this.s.first ? 0 : 1
  }
  protected begin() {
    const board = Array(64).fill(0)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if ((x + y) % 2 === 1) {
          if (y < 3) board[y * 8 + x] = 3
          else if (y > 4) board[y * 8 + x] = 1
        }
    const first = (this.gameNo - 1) % 2
    this.s = { board, first, turn: first, last: null, quiet: 0, over: false, winner: -1 }
  }
  turn() {
    return this.status === 'playing' && !this.s.over ? this.s.turn : -1
  }
  private moves() {
    return movesFor(this.s.board, this.sideOf(this.s.turn))
  }
  protected act(seat: number, m: any): string | null {
    const from = Number(m?.from),
      to = Number(m?.to)
    const all = this.moves()
    // a destination can be reached by one chain only in practice; if several end on the same square the first listed is used
    const hit = all.find(
      (x) => x.path[0] === from && x.path[x.path.length - 1] === to && (!Array.isArray(m?.via) || x.path.slice(1, -1).join() === m.via.join()),
    )
    if (!hit) return 'bad_move'
    this.make(seat, hit)
    return null
  }
  private make(seat: number, mv: CMove) {
    const wasMan = this.s.board[mv.path[0]] === 1 || this.s.board[mv.path[0]] === 3
    this.s.board = apply(this.s.board, mv)
    this.s.last = mv.path
    this.s.quiet = mv.caps.length || wasMan ? 0 : this.s.quiet + 1
    this.s.turn = 1 - seat
    if (!this.moves().length) {
      this.s.over = true
      this.s.winner = seat
    } else if (this.s.quiet >= 80) {
      this.s.over = true
      this.s.winner = -1
    }
  }
  // ---- the bot ----
  protected bot(seat: number) {
    const all = this.moves()
    if (!all.length) return
    const level = this.config.level
    const depth = level === 'easy' ? 1 : level === 'hard' ? 6 : 4
    if (level === 'easy' && Math.random() < 0.35) return this.make(seat, all[Math.floor(Math.random() * all.length)])
    const me = this.sideOf(seat)
    let best = -Infinity,
      picks: CMove[] = []
    for (const m of all) {
      const v = -this.search(apply(this.s.board, m), 1 - me, depth - 1, -Infinity, Infinity)
      if (v > best + 0.5) {
        best = v
        picks = [m]
      } else if (Math.abs(v - best) <= 0.5) picks.push(m)
    }
    this.make(seat, picks[Math.floor(Math.random() * picks.length)])
  }
  private search(b: number[], who: number, depth: number, alpha: number, beta: number): number {
    const ms = movesFor(b, who)
    if (!ms.length) return -10000 - depth
    if (depth === 0) return this.eval(b, who)
    let best = -Infinity
    for (const m of ms) {
      const v = -this.search(apply(b, m), 1 - who, depth - 1, -beta, -alpha)
      if (v > best) best = v
      if (best > alpha) alpha = best
      if (alpha >= beta) break
    }
    return best
  }
  private eval(b: number[], who: number): number {
    let v = 0
    for (let i = 0; i < 64; i++) {
      const p = b[i]
      if (!p) continue
      const s = side(p),
        y = Math.floor(i / 8),
        x = i % 8
      let val = isKing(p) ? 170 : 100
      if (!isKing(p)) val += s === 0 ? (7 - y) * 4 : y * 4 // advancing men
      if (x === 0 || x === 7) val += 3 // edges are safe
      if (!isKing(p) && ((s === 0 && y === 7) || (s === 1 && y === 0))) val += 6 // back row guards
      v += s === who ? val : -val
    }
    return v
  }

  protected gameView() {
    const mine = this.s.over ? [] : this.moves()
    return {
      board: this.s.board,
      first: this.s.first,
      last: this.s.last,
      moves: mine.map((m) => ({ from: m.path[0], to: m.path[m.path.length - 1], via: m.path.slice(1, -1), caps: m.caps })),
      quiet: this.s.quiet,
    }
  }
  protected outcome(): Outcome | null {
    if (!this.s.over) return null
    if (this.s.winner < 0) return { points: [0, 0], winner: -1 }
    return { points: this.s.winner === 0 ? [1, -1] : [-1, 1], winner: this.s.winner }
  }
  protected saveState() {
    return this.s
  }
  protected loadState(s: State) {
    this.s = s
  }
}
