import { TurnGame, type GameMeta, type Outcome } from './base'

/**
 * Chinese Checkers, 2 to 6 players, ten marbles each on a six-pointed star of 121 holes. Move a marble to a neighbouring hole, or jump over a
 * neighbouring marble into the empty hole just beyond it and keep jumping in a chain. First to fill the opposite point of the star wins.
 * Camps: with 2 players opposite points, 3 players every second point, 4 players two opposite pairs, 6 players all of them.
 */
export const CC_META: GameMeta = {
  kind: 'chinesecheckers', minPlayers: 2, maxPlayers: 6, variable: true, chipUnit: 250,
  fields: [{ key: 'players', label: 'ccPlayers', options: [[2, '2'], [3, '3'], [4, '4'], [6, '6']] }],
  defaults: { players: 2, ranked: false },
}

/** the 121 holes in cube coordinates (x + y + z = 0): two big triangles overlap in a hexagon, the union is the star */
export const HOLES: [number, number, number][] = []
const INDEX = new Map<string, number>()
for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
  const z = -x - y
  if ((x >= -4 && y >= -4 && z >= -4) || (x <= 4 && y <= 4 && z <= 4)) { INDEX.set(`${x},${y}`, HOLES.length); HOLES.push([x, y, z]) }
}
export const idx = (x: number, y: number) => INDEX.get(`${x},${y}`) ?? -1
const DIRS: [number, number][] = [[1, -1], [-1, 1], [1, 0], [-1, 0], [0, 1], [0, -1]]
export const NEIGH: number[][] = HOLES.map(([x, y]) => DIRS.map(([dx, dy]) => idx(x + dx, y + dy)))
/** the hole reached by jumping from i over its neighbour in direction d (-1 when off the board) */
export const JUMP: number[][] = HOLES.map(([x, y], i) => DIRS.map(([dx, dy], d) => (NEIGH[i][d] >= 0 ? idx(x + 2 * dx, y + 2 * dy) : -1)))

/** the six points of the star, in order round the board; the opposite point is three along */
const CAMP_TEST: ((h: [number, number, number]) => boolean)[] = [
  (h) => h[0] >= 5, (h) => h[2] <= -5, (h) => h[1] >= 5, (h) => h[0] <= -5, (h) => h[2] >= 5, (h) => h[1] <= -5,
]
export const CAMPS: number[][] = CAMP_TEST.map((f) => HOLES.map((h, i) => (f(h) ? i : -1)).filter((i) => i >= 0))
/** which camps the seats start in, for each table size */
export const LAYOUT: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 3, 1, 4], 6: [0, 1, 2, 3, 4, 5] }
const dist = (a: number, b: number) => { const p = HOLES[a], q = HOLES[b]; return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])) }

interface State { cells: number[]; n: number; turn: number; last: [number, number] | null; moves: number; winner: number; finished: number[] }

export class ChineseCheckers extends TurnGame {
  readonly meta = CC_META
  private s: State = { cells: [], n: 2, turn: 0, last: null, moves: 0, winner: -1, finished: [] }
  private camp(seat: number) { return LAYOUT[this.s.n][seat] }
  private target(seat: number) { return (this.camp(seat) + 3) % 6 }
  protected begin() {
    const n = this.seats.length
    const cells = Array(HOLES.length).fill(-1)
    const lay = LAYOUT[n] ?? LAYOUT[2]
    lay.forEach((c, seat) => { for (const h of CAMPS[c]) cells[h] = seat })
    this.s = { cells, n, turn: (this.gameNo - 1) % n, last: null, moves: 0, winner: -1, finished: [] }
  }
  turn() { return this.status === 'playing' && this.s.winner < 0 ? this.s.turn : -1 }

  /** every hole a marble on `from` can reach this turn: single steps, or chains of jumps */
  reach(cells: number[], from: number): Set<number> {
    const out = new Set<number>()
    for (const k of NEIGH[from]) if (k >= 0 && cells[k] === -1) out.add(k)
    const seen = new Set<number>([from]), stack = [from]
    while (stack.length) {
      const c = stack.pop()!
      for (let d = 0; d < 6; d++) {
        const over = NEIGH[c][d], to = JUMP[c][d]
        if (over < 0 || to < 0 || cells[over] === -1 || cells[to] !== -1 || seen.has(to)) continue
        seen.add(to); out.add(to); stack.push(to)
      }
    }
    return out
  }
  protected act(seat: number, m: any): string | null {
    const from = Number(m?.from), to = Number(m?.to)
    if (!Number.isInteger(from) || !Number.isInteger(to) || this.s.cells[from] !== seat) return 'bad_move'
    if (!this.reach(this.s.cells, from).has(to)) return 'bad_move'
    this.move(seat, from, to)
    return null
  }
  private move(seat: number, from: number, to: number) {
    this.s.cells[from] = -1; this.s.cells[to] = seat
    this.s.last = [from, to]; this.s.moves++
    if (this.home(seat)) { this.s.winner = seat; return }
    if (this.s.moves >= 100 * this.s.n) { // a very long game ends by who is furthest along
      this.s.winner = Array.from({ length: this.s.n }, (_, i) => i).sort((a, b) => this.progress(b) - this.progress(a))[0]; return
    }
    this.s.turn = (seat + 1) % this.s.n
  }
  /** how far a seat is from filling its goal: the negative total distance of its marbles to the far tip (higher is better) */
  private progress(seat: number) {
    const goal = CAMPS[this.target(seat)]
    const apex = goal.reduce((a, h) => (HOLES[h][0] ** 2 + HOLES[h][1] ** 2 + HOLES[h][2] ** 2 > HOLES[a][0] ** 2 + HOLES[a][1] ** 2 + HOLES[a][2] ** 2 ? h : a), goal[0])
    let total = 0
    this.s.cells.forEach((c, i) => { if (c === seat) total += dist(i, apex) })
    return -total
  }
  private home(seat: number) { return CAMPS[this.target(seat)].every((h) => this.s.cells[h] === seat) }

  // ---- the bot: advance toward the far point, keep the rear marbles from being left behind ----
  protected bot(seat: number) {
    const goal = CAMPS[this.target(seat)]
    const apex = goal.reduce((a, h) => (HOLES[h][0] ** 2 + HOLES[h][1] ** 2 + HOLES[h][2] ** 2 > HOLES[a][0] ** 2 + HOLES[a][1] ** 2 + HOLES[a][2] ** 2 ? h : a), goal[0])
    const inGoal = new Set(goal)
    const mine: number[] = []
    this.s.cells.forEach((c, i) => { if (c === seat) mine.push(i) })
    const worstBefore = Math.max(...mine.filter((i) => !inGoal.has(i)).map((i) => dist(i, apex)), 0)
    let best = -Infinity, picks: [number, number][] = []
    for (const from of mine) {
      if (inGoal.has(from) && this.s.cells.filter((c, i) => inGoal.has(i) && c === seat).length === 10) continue
      for (const to of this.reach(this.s.cells, from)) {
        // a marble already in the goal only moves deeper into it
        if (inGoal.has(from) && !inGoal.has(to)) continue
        let v = dist(from, apex) - dist(to, apex)
        if (inGoal.has(to) && !inGoal.has(from)) v += 2
        if (inGoal.has(from) && inGoal.has(to)) v += dist(from, apex) - dist(to, apex) > 0 ? 0 : -3
        if (!inGoal.has(from) && dist(from, apex) === worstBefore) v += 1.5 // move the straggler
        v += Math.random() * 0.4
        if (v > best) { best = v; picks = [[from, to]] } else if (v > best - 0.01) picks.push([from, to])
      }
    }
    if (!picks.length) { // nothing useful (boxed in): any legal step
      for (const from of mine) for (const to of this.reach(this.s.cells, from)) picks.push([from, to])
    }
    if (!picks.length) { this.s.turn = (seat + 1) % this.s.n; return }
    const [from, to] = picks[Math.floor(Math.random() * picks.length)]
    this.move(seat, from, to)
  }

  protected gameView(seat: number) {
    const dests: Record<number, number[]> = {}
    if (seat >= 0 && this.s.turn === seat && this.s.winner < 0) this.s.cells.forEach((c, i) => { if (c === seat) { const r = this.reach(this.s.cells, i); if (r.size) dests[i] = [...r] } })
    return { cells: this.s.cells, n: this.s.n, camps: LAYOUT[this.s.n], last: this.s.last, moves: this.s.moves, winner: this.s.winner, dests }
  }
  /** points by how far each seat got: the winner first, then by marbles already home and the distance still to go */
  protected outcome(): Outcome | null {
    if (this.s.winner < 0) return null
    const n = this.s.n
    const prog = Array.from({ length: n }, (_, seat) => (seat === this.s.winner ? Infinity : this.progress(seat)))
    const order = prog.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i)
    const points = Array(n).fill(0)
    order.forEach((seat, rank) => { points[seat] = (n - 1) - 2 * rank }) // 1st gets +(n-1), last gets -(n-1)
    return { points, winner: this.s.winner }
  }
  protected saveState() { return this.s }
  protected loadState(s: State) { this.s = s }
}
