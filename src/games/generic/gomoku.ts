import { TurnGame, type GameMeta, type Outcome } from './base'

/** Gomoku (five in a row): two players on a 15 x 15 or 19 x 19 board, black moves first, five or more in a line wins. */
export const GOMOKU_META: GameMeta = {
  kind: 'gomoku', minPlayers: 2, maxPlayers: 2, variable: false, chipUnit: 500,
  fields: [{ key: 'size', label: 'gmSize', options: [[15, '15 × 15'], [19, '19 × 19']] }],
  defaults: { size: 15, ranked: false },
}
const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]]

interface State { board: number[]; black: number; turn: number; moves: [number, number][]; win: [number, number][] | null; full: boolean }

export class Gomoku extends TurnGame {
  readonly meta = GOMOKU_META
  private s: State = { board: [], black: 0, turn: 0, moves: [], win: null, full: false }
  private get n() { return Number(this.config.size) === 19 ? 19 : 15 }

  protected begin() {
    // the colours swap every game, so a rematch is fair
    this.s = { board: Array(this.n * this.n).fill(0), black: (this.gameNo - 1) % 2, turn: (this.gameNo - 1) % 2, moves: [], win: null, full: false }
  }
  turn() { return this.status === 'playing' && !this.s.win && !this.s.full ? this.s.turn : -1 }
  private at(x: number, y: number) { return x < 0 || y < 0 || x >= this.n || y >= this.n ? -1 : this.s.board[y * this.n + x] }
  /** the line through (x,y) for `who`, if it has five or more */
  private line(x: number, y: number, who: number): [number, number][] | null {
    for (const [dx, dy] of DIRS) {
      const cells: [number, number][] = [[x, y]]
      for (const sign of [1, -1]) { let k = 1; while (this.at(x + dx * k * sign, y + dy * k * sign) === who) { cells.push([x + dx * k * sign, y + dy * k * sign]); k++ } }
      if (cells.length >= 5) return cells
    }
    return null
  }
  protected act(seat: number, m: any): string | null {
    const x = Number(m?.x), y = Number(m?.y)
    if (!Number.isInteger(x) || !Number.isInteger(y) || this.at(x, y) !== 0) return 'bad_move'
    this.place(seat, x, y)
    return null
  }
  private place(seat: number, x: number, y: number) {
    const who = seat === this.s.black ? 1 : 2
    this.s.board[y * this.n + x] = who
    this.s.moves.push([x, y])
    const w = this.line(x, y, who)
    if (w) this.s.win = w
    else if (this.s.moves.length >= this.n * this.n) this.s.full = true
    this.s.turn = 1 - seat
  }

  // ---- the bot: score every empty cell near the stones by what it builds for me and what it stops for them ----
  private patternScore(x: number, y: number, who: number): number {
    let total = 0
    for (const [dx, dy] of DIRS) {
      let count = 1, open = 0
      for (const sign of [1, -1]) {
        let k = 1
        while (this.at(x + dx * k * sign, y + dy * k * sign) === who) { count++; k++ }
        if (this.at(x + dx * k * sign, y + dy * k * sign) === 0) open++
      }
      if (count >= 5) total += 100000
      else if (count === 4) total += open === 2 ? 12000 : open === 1 ? 1500 : 0
      else if (count === 3) total += open === 2 ? 1400 : open === 1 ? 120 : 0
      else if (count === 2) total += open === 2 ? 90 : open === 1 ? 12 : 0
      else if (count === 1) total += open === 2 ? 3 : 0
    }
    return total
  }
  protected bot(seat: number) {
    const me = seat === this.s.black ? 1 : 2, them = 3 - me
    const mid = Math.floor(this.n / 2)
    if (this.s.moves.length === 0) return this.place(seat, mid, mid)
    let best = -1, picks: [number, number][] = []
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      if (this.at(x, y) !== 0) continue
      let near = false
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (this.at(x + dx, y + dy) > 0) { near = true; break }
      if (!near) continue
      const centre = 4 - (Math.abs(x - mid) + Math.abs(y - mid)) / this.n * 4
      const score = this.patternScore(x, y, me) * 1.05 + this.patternScore(x, y, them) + centre
      if (score > best + 0.5) { best = score; picks = [[x, y]] } else if (Math.abs(score - best) <= 0.5) picks.push([x, y])
    }
    if (!picks.length) picks = [[mid, mid]]
    const [px, py] = picks[Math.floor(Math.random() * picks.length)]
    this.place(seat, px, py)
  }

  protected gameView() {
    return { size: this.n, board: this.s.board, black: this.s.black, last: this.s.moves.at(-1) ?? null, win: this.s.win, moves: this.s.moves.length, full: this.s.full }
  }
  protected outcome(): Outcome | null {
    if (this.s.win) { const winner = this.s.turn === 0 ? 1 : 0; return { points: winner === 0 ? [1, -1] : [-1, 1], winner } } // the player who just moved won
    if (this.s.full) return { points: [0, 0], winner: -1 }
    return null
  }
  protected saveState() { return this.s }
  protected loadState(s: State) { this.s = s }
}
