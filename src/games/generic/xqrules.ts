/**
 * Xiangqi (Chinese chess) rules, no dependencies. The board has 9 files and 10 ranks; index = rank * 9 + file, rank 0 is Red's back rank (the bottom),
 * Red moves up the board. Pieces: 1 general, 2 advisor, 3 elephant, 4 horse, 5 chariot, 6 cannon, 7 soldier; Red positive, Black negative.
 * Rules: the general and advisors stay in the palace; elephants stay on their side and are blocked at the "eye"; horses are blocked at the "leg";
 * cannons capture by jumping exactly one piece; soldiers step forward and, after the river, sideways; the two generals may never face each other
 * on an open file; a side with no legal move has lost (mate and stalemate both lose).
 */
export interface Pos { b: number[]; turn: 1 | -1; half: number }
export interface Move { from: number; to: number }
const W = 9, H = 10
const file = (s: number) => s % W, rank = (s: number) => Math.floor(s / W)
const at = (f: number, r: number) => (f < 0 || f >= W || r < 0 || r >= H ? -1 : r * W + f)

export const START_FEN = 'rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR w'
const LETTER: Record<string, number> = { k: 1, a: 2, e: 3, h: 4, r: 5, c: 6, p: 7 }
export function fromFen(fen: string): Pos {
  const [pl, tn, hm] = fen.trim().split(/\s+/)
  const b = Array(W * H).fill(0)
  pl.split('/').forEach((row, i) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) f += Number(ch); else { b[(9 - i) * W + f] = (ch === ch.toLowerCase() ? -1 : 1) * LETTER[ch.toLowerCase()]; f++ } } })
  return { b, turn: tn === 'b' ? -1 : 1, half: Number(hm ?? 0) }
}
export function toFen(p: Pos): string {
  const L = ['', 'k', 'a', 'e', 'h', 'r', 'c', 'p']
  const rows: string[] = []
  for (let r = 9; r >= 0; r--) { let s = '', e = 0; for (let f = 0; f < W; f++) { const x = p.b[r * W + f]; if (!x) e++; else { if (e) { s += e; e = 0 } s += x > 0 ? L[x].toUpperCase() : L[-x] } } rows.push(s + (e || '')) }
  return `${rows.join('/')} ${p.turn === 1 ? 'w' : 'b'} ${p.half}`
}
export const startPos = () => fromFen(START_FEN)
const inPalace = (s: number, c: number) => { const f = file(s), r = rank(s); return f >= 3 && f <= 5 && (c === 1 ? r <= 2 : r >= 7) }

function pseudo(p: Pos): Move[] {
  const out: Move[] = []
  const me = p.turn
  const own = (to: number) => Math.sign(p.b[to]) === me
  const add = (from: number, to: number) => { if (to >= 0 && !own(to)) out.push({ from, to }) }
  for (let s = 0; s < W * H; s++) {
    const x = p.b[s]
    if (!x || Math.sign(x) !== me) continue
    const t = Math.abs(x), f = file(s), r = rank(s)
    if (t === 1) { for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const to = at(f + df, r + dr); if (to >= 0 && inPalace(to, me)) add(s, to) } }
    else if (t === 2) { for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const to = at(f + df, r + dr); if (to >= 0 && inPalace(to, me)) add(s, to) } }
    else if (t === 3) {
      for (const [df, dr] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
        const to = at(f + df, r + dr), eye = at(f + df / 2, r + dr / 2)
        if (to >= 0 && !p.b[eye] && (me === 1 ? rank(to) <= 4 : rank(to) >= 5)) add(s, to)
      }
    } else if (t === 4) {
      for (const [lf, lr, df, dr] of [[1, 0, 2, 1], [1, 0, 2, -1], [-1, 0, -2, 1], [-1, 0, -2, -1], [0, 1, 1, 2], [0, 1, -1, 2], [0, -1, 1, -2], [0, -1, -1, -2]]) {
        const leg = at(f + lf, r + lr); if (leg < 0 || p.b[leg]) continue
        add(s, at(f + df, r + dr))
      }
    } else if (t === 5) {
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; ; k++) { const to = at(f + df * k, r + dr * k); if (to < 0) break; if (!p.b[to]) out.push({ from: s, to }); else { if (!own(to)) out.push({ from: s, to }); break } }
    } else if (t === 6) {
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let k = 1
        for (; ; k++) { const to = at(f + df * k, r + dr * k); if (to < 0) break; if (!p.b[to]) out.push({ from: s, to }); else break }
        for (k++; ; k++) { const to = at(f + df * k, r + dr * k); if (to < 0) break; if (p.b[to]) { if (!own(to)) out.push({ from: s, to }); break } } // jump exactly one piece
      }
    } else if (t === 7) {
      add(s, at(f, r + me))
      if (me === 1 ? r >= 5 : r <= 4) { add(s, at(f + 1, r)); add(s, at(f - 1, r)) }
    }
  }
  return out
}
export function play(p: Pos, m: Move): Pos {
  const b = [...p.b]
  const cap = b[m.to] !== 0
  b[m.to] = b[m.from]; b[m.from] = 0
  return { b, turn: (-p.turn) as 1 | -1, half: cap ? 0 : p.half + 1 }
}
const kingAt = (p: Pos, c: 1 | -1) => p.b.indexOf(c)
/** the general of colour c is attacked (by a piece, or by the other general across an open file) */
export function inCheck(p: Pos, c: 1 | -1 = p.turn): boolean {
  const k = kingAt(p, c), o = kingAt(p, (-c) as 1 | -1)
  if (k < 0) return true
  if (o >= 0 && file(k) === file(o)) { let open = true; for (let r = Math.min(rank(k), rank(o)) + 1; r < Math.max(rank(k), rank(o)); r++) if (p.b[r * W + file(k)]) { open = false; break } if (open) return true }
  const q = { ...p, turn: (-c) as 1 | -1 }
  return pseudo(q).some((m) => m.to === k)
}
export function legal(p: Pos): Move[] { return pseudo(p).filter((m) => !inCheck(play(p, m), p.turn)) }
export type End = { over: false } | { over: true; result: 'mate' | 'stalemate' | 'repetition' | 'norace' | 'resign' | 'cap'; winner: 1 | -1 | 0 }
export const key = (p: Pos) => toFen(p).split(' ').slice(0, 2).join(' ')
export function ending(p: Pos, keys: string[]): End {
  if (legal(p).length === 0) return { over: true, result: inCheck(p) ? 'mate' : 'stalemate', winner: (-p.turn) as 1 | -1 } // either way the side to move has lost
  const k = key(p)
  if (keys.filter((x) => x === k).length >= 3) return { over: true, result: 'repetition', winner: 0 }
  if (p.half >= 120) return { over: true, result: 'norace', winner: 0 }
  return { over: false }
}
export function perft(p: Pos, depth: number): number { if (depth === 0) return 1; const ms = legal(p); if (depth === 1) return ms.length; let n = 0; for (const m of ms) n += perft(play(p, m), depth - 1); return n }

// ---------------------------------------------------------------- a small computer opponent
const VALUE = [0, 10000, 200, 200, 420, 900, 450, 100]
export function evaluate(p: Pos): number {
  let score = 0
  for (let s = 0; s < W * H; s++) {
    const x = p.b[s]; if (!x) continue
    const t = Math.abs(x), c = Math.sign(x), r = c === 1 ? rank(s) : 9 - rank(s), f = file(s)
    let v = VALUE[t]
    const mid = 4 - Math.abs(f - 4)
    if (t === 7) v += (r >= 5 ? 110 + (r - 5) * 12 : 0) + mid * 3
    else if (t === 4) v += mid * 8 + (r >= 3 ? 14 : 0)
    else if (t === 5) v += mid * 3 + (r >= 4 ? 14 : 0)
    else if (t === 6) v += mid * 5
    score += c * v
  }
  return score * p.turn
}
const order = (p: Pos, ms: Move[]) => ms.map((m) => ({ m, k: p.b[m.to] ? 10 * VALUE[Math.abs(p.b[m.to])] - VALUE[Math.abs(p.b[m.from])] : 0 })).sort((a, b) => b.k - a.k).map((x) => x.m)
function search(p: Pos, depth: number, alpha: number, beta: number, budget: { n: number }): number {
  if (budget.n-- <= 0) return evaluate(p)
  const ms = legal(p)
  if (ms.length === 0) return -100000 - depth
  if (depth === 0) return evaluate(p)
  let best = -Infinity
  for (const m of order(p, ms)) {
    const v = -search(play(p, m), depth - 1, -beta, -alpha, budget)
    if (v > best) best = v
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}
export function bestMove(p: Pos, depth: number, noise = 10): Move | null {
  const ms = legal(p)
  if (!ms.length) return null
  const budget = { n: 50000 }
  const scored = order(p, ms).map((m) => ({ m, v: -search(play(p, m), Math.max(0, depth - 1), -Infinity, Infinity, budget) + (Math.random() - 0.5) * noise }))
  scored.sort((a, b) => b.v - a.v)
  return scored[0].m
}
export const FILES = 'abcdefghi'
export const sqName = (s: number) => FILES[file(s)] + rank(s)
/** a short text for the move list, e.g. "C h2-e2" (piece letter, from, to) */
export function text(p: Pos, m: Move): string { const t = Math.abs(p.b[m.from]); return `${' KAEHRCP'[t]}${sqName(m.from)}${p.b[m.to] ? 'x' : '-'}${sqName(m.to)}` }
