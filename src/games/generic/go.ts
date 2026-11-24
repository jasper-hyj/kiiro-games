import { TurnGame, type GameMeta, type Outcome } from './base'

/**
 * Go on 9, 13 or 19 lines. Stones with no empty neighbour left (no liberties) are captured; suicide and an immediate recapture that repeats the
 * last position (ko) are not allowed. Two passes in a row end the game and it is counted by area: your stones plus the empty regions only you
 * touch, with komi for White. Dead stones are not marked: capture them before you pass.
 */
export const GO_META: GameMeta = {
  kind: 'go', minPlayers: 2, maxPlayers: 2, variable: false, chipUnit: 500,
  fields: [
    { key: 'size', label: 'goSize', options: [[9, '9 × 9'], [13, '13 × 13'], [19, '19 × 19']] },
    { key: 'level', label: 'chLevel', options: [['easy', 'chEasy'], ['normal', 'chNormal'], ['hard', 'chHard']] },
  ],
  defaults: { size: 9, level: 'normal', ranked: false },
}
export const KOMI: Record<number, number> = { 9: 5.5, 13: 6.5, 19: 7.5 }

interface State { n: number; board: number[]; prev: number[]; black: number; turn: number; caps: [number, number]; passes: number; last: number; moves: number; over: boolean; resigned: number; score: { b: number; w: number; terr: number[] } | null }

const nbrs = (n: number, i: number) => { const x = i % n, y = Math.floor(i / n), o: number[] = []; if (x > 0) o.push(i - 1); if (x < n - 1) o.push(i + 1); if (y > 0) o.push(i - n); if (y < n - 1) o.push(i + n); return o }
/** the group containing i and its liberties */
function group(n: number, b: number[], i: number) {
  const who = b[i], seen = new Set<number>([i]), libs = new Set<number>(), stack = [i]
  while (stack.length) { const c = stack.pop()!; for (const k of nbrs(n, c)) { if (b[k] === 0) libs.add(k); else if (b[k] === who && !seen.has(k)) { seen.add(k); stack.push(k) } } }
  return { stones: [...seen], libs }
}
/** play `who` at i on a copy of the board: the new board and the stones taken, or null when the move is illegal on its own (occupied or suicide) */
function tryPlay(n: number, b: number[], i: number, who: number): { board: number[]; taken: number[] } | null {
  if (b[i] !== 0) return null
  const nb = b.slice(); nb[i] = who
  const taken: number[] = []
  for (const k of nbrs(n, i)) if (nb[k] === 3 - who) { const g = group(n, nb, k); if (g.libs.size === 0) for (const s of g.stones) if (nb[s] !== 0) { nb[s] = 0; taken.push(s) } }
  if (group(n, nb, i).libs.size === 0) return null
  return { board: nb, taken }
}
/** area score of each colour and who owns each empty point */
export function areaScore(n: number, b: number[]) {
  let bs = 0, ws = 0
  const terr = Array(n * n).fill(0)
  const seen = new Set<number>()
  for (let i = 0; i < n * n; i++) {
    if (b[i] === 1) bs++
    else if (b[i] === 2) ws++
    else if (!seen.has(i)) {
      const region = [i], stack = [i]; seen.add(i); const border = new Set<number>()
      while (stack.length) { const c = stack.pop()!; for (const k of nbrs(n, c)) { if (b[k] === 0) { if (!seen.has(k)) { seen.add(k); region.push(k); stack.push(k) } } else border.add(b[k]) } }
      if (border.size === 1) { const o = [...border][0]; for (const r of region) terr[r] = o; if (o === 1) bs += region.length; else ws += region.length }
    }
  }
  return { b: bs, w: ws, terr }
}

export class Go extends TurnGame {
  readonly meta = GO_META
  private s: State = { n: 9, board: [], prev: [], black: 0, turn: 0, caps: [0, 0], passes: 0, last: -1, moves: 0, over: false, resigned: -1, score: null }
  private get n() { return [9, 13, 19].includes(Number(this.config.size)) ? Number(this.config.size) : 9 }
  private colour(seat: number) { return seat === this.s.black ? 1 : 2 }
  protected begin() {
    const n = this.n
    const black = (this.gameNo - 1) % 2
    this.s = { n, board: Array(n * n).fill(0), prev: Array(n * n).fill(0), black, turn: black, caps: [0, 0], passes: 0, last: -1, moves: 0, over: false, resigned: -1, score: null }
  }
  turn() { return this.status === 'playing' && !this.s.over ? this.s.turn : -1 }
  private legalAt(i: number, who: number) {
    const r = tryPlay(this.s.n, this.s.board, i, who)
    if (!r) return null
    if (r.board.every((c, k) => c === this.s.prev[k])) return null // ko
    return r
  }
  protected act(seat: number, m: any): string | null {
    if (m?.resign === true) { this.s.over = true; this.s.resigned = seat; return null }
    if (m?.pass === true) { this.pass(seat); return null }
    const x = Number(m?.x), y = Number(m?.y), n = this.s.n
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= n || y >= n) return 'bad_move'
    if (!this.legalAt(y * n + x, this.colour(seat))) return 'bad_move'
    this.place(seat, y * n + x)
    return null
  }
  private place(seat: number, i: number) {
    const who = this.colour(seat), r = this.legalAt(i, who)!
    this.s.prev = this.s.board
    this.s.board = r.board
    this.s.caps[seat] += r.taken.length
    this.s.last = i; this.s.passes = 0; this.s.moves++; this.s.turn = 1 - seat
  }
  private pass(seat: number) {
    this.s.prev = this.s.board.slice()
    this.s.passes++; this.s.last = -1; this.s.moves++; this.s.turn = 1 - seat
    if (this.s.passes >= 2) this.finish()
  }
  private finish() {
    this.s.over = true
    this.s.score = areaScore(this.s.n, this.s.board)
  }

  // ---- the bot ----
  protected bot(seat: number) {
    const n = this.s.n, who = this.colour(seat), b = this.s.board
    const level = this.config.level
    const noise = level === 'easy' ? 9 : level === 'hard' ? 1.2 : 3.5
    const cap = n * n * 2
    // answer a pass by passing when ahead (every stone on the board counts, so the bot only passes when it has nothing left to gain)
    if (this.s.passes === 1 || this.s.moves > cap) {
      const sc = areaScore(n, b), komi = KOMI[n]
      const mine = who === 1 ? sc.b : sc.w + komi, theirs = who === 1 ? sc.w + komi : sc.b
      if (mine > theirs || this.s.moves > cap) return this.pass(seat)
    }
    let best = -Infinity, pick = -1
    const stones = b.reduce((a, c) => a + (c ? 1 : 0), 0)
    for (let i = 0; i < n * n; i++) {
      if (b[i] !== 0) continue
      const r = this.legalAt(i, who)
      if (!r) continue
      const ns = nbrs(n, i)
      // never fill one of its own eyes
      if (ns.every((k) => b[k] === who) && r.taken.length === 0) continue
      const x = i % n, y = Math.floor(i / n), line = Math.min(x, y, n - 1 - x, n - 1 - y)
      let score = Math.random() * noise
      score += r.taken.length * 9
      // atari: a neighbouring enemy group that is left with one liberty
      const seenG = new Set<number>()
      for (const k of ns) if (r.board[k] === 3 - who && !seenG.has(k)) { const g = group(n, r.board, k); g.stones.forEach((s) => seenG.add(s)); if (g.libs.size === 1) score += 3 + Math.min(6, g.stones.length) }
      // saving my own group in atari / keeping liberties
      for (const k of ns) if (b[k] === who) { const before = group(n, b, k).libs.size, after = group(n, r.board, i).libs.size; if (before === 1 && after > 1) score += 10; break }
      const mine = group(n, r.board, i)
      if (mine.libs.size === 1 && r.taken.length === 0) score -= 14 // self-atari
      if (line === 0) score -= stones < n * 3 ? 6 : 2
      else if (line === 1) score -= stones < n * 3 ? 2 : 0.5
      else if (line >= 2 && line <= 3) score += 1.5
      // near stones is where the fight is; far from everything is only good in the opening
      let near = 0
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < n && yy < n && b[yy * n + xx]) near++ }
      score += near ? Math.min(near, 4) * 0.8 : (stones < 4 ? 1 : -2)
      if (stones < 2 && n >= 9) { const mid = Math.floor(n / 2), a = n >= 13 ? 3 : 2; if ((x === a || x === n - 1 - a || x === mid) && (y === a || y === n - 1 - a || y === mid)) score += 5 }
      if (score > best) { best = score; pick = i }
    }
    // nothing worth playing: pass (this ends the game when the opponent has just passed)
    const hopeless = pick < 0 || (best < -2 && stones > n * n * 0.45)
    if (hopeless) return this.pass(seat)
    this.place(seat, pick)
  }

  protected gameView() {
    return { n: this.s.n, board: this.s.board, black: this.s.black, caps: this.s.caps, last: this.s.last, passes: this.s.passes, moves: this.s.moves, komi: KOMI[this.s.n], score: this.s.score, resigned: this.s.resigned }
  }
  protected outcome(): Outcome | null {
    if (!this.s.over) return null
    if (this.s.resigned >= 0) { const w = 1 - this.s.resigned; return { points: w === 0 ? [1, -1] : [-1, 1], winner: w } }
    const sc = this.s.score ?? areaScore(this.s.n, this.s.board), komi = KOMI[this.s.n]
    const blackWins = sc.b > sc.w + komi
    const winner = blackWins ? this.s.black : 1 - this.s.black
    return { points: winner === 0 ? [1, -1] : [-1, 1], winner, summary: { black: sc.b, white: sc.w, komi } }
  }
  protected saveState() { return this.s }
  protected loadState(s: State) { this.s = s }
}
