/**
 * Chess rules with no dependencies: move generation (castling, en passant, promotion), check, mate, stalemate and the draw rules.
 * Squares are 0..63 with a1 = 0, h1 = 7, a8 = 56. Pieces: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king; white positive, black negative.
 * The rules are checked against the published perft counts in scripts/generic/chess-test.ts.
 */
export interface Pos { b: number[]; turn: 1 | -1; castle: number; ep: number; half: number; full: number }
export interface Move { from: number; to: number; promo?: number; ep?: boolean; castle?: 'K' | 'Q'; double?: boolean }
// castling right bits: white king side, white queen side, black king side, black queen side
const WK = 1, WQ = 2, BK = 4, BQ = 8
const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const file = (s: number) => s & 7, rank = (s: number) => s >> 3
const sq = (f: number, r: number) => (f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f)

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const LETTER: Record<string, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 }
export function fromFen(fen: string): Pos {
  const [pl, tn, ca, ep, hm, fm] = fen.trim().split(/\s+/)
  const b = Array(64).fill(0)
  pl.split('/').forEach((row, i) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) f += Number(ch); else { b[(7 - i) * 8 + f] = (ch === ch.toLowerCase() ? -1 : 1) * LETTER[ch.toLowerCase()]; f++ } } })
  let castle = 0; for (const ch of ca ?? '') castle |= ch === 'K' ? WK : ch === 'Q' ? WQ : ch === 'k' ? BK : ch === 'q' ? BQ : 0
  return { b, turn: tn === 'b' ? -1 : 1, castle, ep: ep && ep !== '-' ? sq(ep.charCodeAt(0) - 97, Number(ep[1]) - 1) : -1, half: Number(hm ?? 0), full: Number(fm ?? 1) }
}
export function toFen(p: Pos): string {
  const L = ['', 'p', 'n', 'b', 'r', 'q', 'k']
  const rows: string[] = []
  for (let r = 7; r >= 0; r--) { let s = '', e = 0; for (let f = 0; f < 8; f++) { const x = p.b[r * 8 + f]; if (!x) e++; else { if (e) { s += e; e = 0 } s += x > 0 ? L[x].toUpperCase() : L[-x] } } rows.push(s + (e || '')) }
  const ca = (p.castle & WK ? 'K' : '') + (p.castle & WQ ? 'Q' : '') + (p.castle & BK ? 'k' : '') + (p.castle & BQ ? 'q' : '') || '-'
  return `${rows.join('/')} ${p.turn === 1 ? 'w' : 'b'} ${ca} ${p.ep < 0 ? '-' : String.fromCharCode(97 + file(p.ep)) + (rank(p.ep) + 1)} ${p.half} ${p.full}`
}
export const startPos = () => fromFen(START_FEN)
export const name = (s: number) => String.fromCharCode(97 + file(s)) + (rank(s) + 1)
export const parseSq = (s: string) => (/^[a-h][1-8]$/.test(s) ? sq(s.charCodeAt(0) - 97, Number(s[1]) - 1) : -1)

/** is square `s` attacked by `by`? */
export function attacked(p: Pos, s: number, by: 1 | -1): boolean {
  const f = file(s), r = rank(s)
  // pawns: a white pawn attacks up the board, so it sits one rank below the target
  const pr = r - by
  for (const df of [-1, 1]) { const q = sq(f + df, pr); if (q >= 0 && p.b[q] === by) return true }
  for (const [df, dr] of KN) { const q = sq(f + df, r + dr); if (q >= 0 && p.b[q] === 2 * by) return true }
  for (const [df, dr] of KG) { const q = sq(f + df, r + dr); if (q >= 0 && p.b[q] === 6 * by) return true }
  for (const [df, dr] of DIAG) for (let k = 1; ; k++) { const q = sq(f + df * k, r + dr * k); if (q < 0) break; const x = p.b[q]; if (x) { if (x === 3 * by || x === 5 * by) return true; break } }
  for (const [df, dr] of ORTH) for (let k = 1; ; k++) { const q = sq(f + df * k, r + dr * k); if (q < 0) break; const x = p.b[q]; if (x) { if (x === 4 * by || x === 5 * by) return true; break } }
  return false
}
const kingSq = (p: Pos, c: 1 | -1) => p.b.indexOf(6 * c)
export const inCheck = (p: Pos, c: 1 | -1 = p.turn) => { const k = kingSq(p, c); return k >= 0 && attacked(p, k, (-c) as 1 | -1) }

function pseudo(p: Pos): Move[] {
  const out: Move[] = []
  const me = p.turn
  for (let s = 0; s < 64; s++) {
    const x = p.b[s]
    if (!x || Math.sign(x) !== me) continue
    const t = Math.abs(x), f = file(s), r = rank(s)
    if (t === 1) {
      const fwd = sq(f, r + me), start = me === 1 ? 1 : 6, last = me === 1 ? 7 : 0
      const push = (to: number, extra: Partial<Move> = {}) => { if (rank(to) === last) for (const promo of [5, 4, 3, 2]) out.push({ from: s, to, promo, ...extra }); else out.push({ from: s, to, ...extra }) }
      if (fwd >= 0 && !p.b[fwd]) { push(fwd); const two = sq(f, r + 2 * me); if (r === start && !p.b[two]) out.push({ from: s, to: two, double: true }) }
      for (const df of [-1, 1]) { const to = sq(f + df, r + me); if (to < 0) continue; if (p.b[to] && Math.sign(p.b[to]) === -me) push(to); else if (to === p.ep) out.push({ from: s, to, ep: true }) }
    } else if (t === 2 || t === 6) {
      for (const [df, dr] of t === 2 ? KN : KG) { const to = sq(f + df, r + dr); if (to >= 0 && Math.sign(p.b[to]) !== me) out.push({ from: s, to }) }
      if (t === 6) { // castling: the king and rook have not moved, the squares between are empty, and the king does not pass through check
        const home = me === 1 ? 0 : 56, opp = (-me) as 1 | -1
        if (s === home + 4 && !attacked(p, s, opp)) {
          if ((p.castle & (me === 1 ? WK : BK)) && p.b[home + 7] === 4 * me && !p.b[home + 5] && !p.b[home + 6] && !attacked(p, home + 5, opp) && !attacked(p, home + 6, opp)) out.push({ from: s, to: home + 6, castle: 'K' })
          if ((p.castle & (me === 1 ? WQ : BQ)) && p.b[home] === 4 * me && !p.b[home + 1] && !p.b[home + 2] && !p.b[home + 3] && !attacked(p, home + 3, opp) && !attacked(p, home + 2, opp)) out.push({ from: s, to: home + 2, castle: 'Q' })
        }
      }
    } else {
      const dirs = t === 3 ? DIAG : t === 4 ? ORTH : [...DIAG, ...ORTH]
      for (const [df, dr] of dirs) for (let k = 1; ; k++) { const to = sq(f + df * k, r + dr * k); if (to < 0) break; const y = p.b[to]; if (!y) out.push({ from: s, to }); else { if (Math.sign(y) !== me) out.push({ from: s, to }); break } }
    }
  }
  return out
}

export function play(p: Pos, m: Move): Pos {
  const b = [...p.b]
  const x = b[m.from], t = Math.abs(x), me = p.turn
  const captured = b[m.to] !== 0 || m.ep
  b[m.to] = m.promo ? m.promo * me : x; b[m.from] = 0
  if (m.ep) b[m.to - 8 * me] = 0
  if (m.castle) { const home = me === 1 ? 0 : 56; if (m.castle === 'K') { b[home + 5] = b[home + 7]; b[home + 7] = 0 } else { b[home + 3] = b[home]; b[home] = 0 } }
  let castle = p.castle
  if (t === 6) castle &= me === 1 ? ~(WK | WQ) : ~(BK | BQ)
  for (const [s, bit] of [[0, WQ], [7, WK], [56, BQ], [63, BK]] as [number, number][]) if (m.from === s || m.to === s) castle &= ~bit
  return { b, turn: (-me) as 1 | -1, castle, ep: m.double ? m.from + 8 * me : -1, half: t === 1 || captured ? 0 : p.half + 1, full: p.full + (me === -1 ? 1 : 0) }
}
export function legal(p: Pos): Move[] {
  return pseudo(p).filter((m) => { const q = play(p, m); return !inCheck(q, p.turn) })
}
export const legalFrom = (p: Pos, from: number) => legal(p).filter((m) => m.from === from)

/** a short move text for the history list (e4, Nf3, exd5, O-O, e8=Q+, Qh5#) */
export function san(p: Pos, m: Move, all: Move[] = legal(p)): string {
  const x = p.b[m.from], t = Math.abs(x)
  let s: string
  if (m.castle) s = m.castle === 'K' ? 'O-O' : 'O-O-O'
  else {
    const cap = p.b[m.to] !== 0 || m.ep
    if (t === 1) s = (cap ? String.fromCharCode(97 + file(m.from)) + 'x' : '') + name(m.to) + (m.promo ? '=' + 'NBRQ'[m.promo - 2] : '')
    else {
      const same = all.filter((o) => o.to === m.to && o.from !== m.from && p.b[o.from] === x)
      const dis = same.length ? (same.every((o) => file(o.from) !== file(m.from)) ? String.fromCharCode(97 + file(m.from)) : same.every((o) => rank(o.from) !== rank(m.from)) ? String(rank(m.from) + 1) : name(m.from)) : ''
      s = ' PNBRQK'[t] + dis + (cap ? 'x' : '') + name(m.to)
    }
  }
  const q = play(p, m)
  if (inCheck(q)) s += legal(q).length ? '+' : '#'
  return s
}

export const key = (p: Pos) => toFen(p).split(' ').slice(0, 4).join(' ')
export function insufficient(p: Pos): boolean {
  const pieces = p.b.filter((x) => x !== 0 && Math.abs(x) !== 6)
  if (pieces.length === 0) return true
  if (pieces.length === 1 && (Math.abs(pieces[0]) === 2 || Math.abs(pieces[0]) === 3)) return true
  if (pieces.every((x) => Math.abs(x) === 3)) { // bishops all on one colour
    const cols = new Set<number>(); p.b.forEach((x, s) => { if (Math.abs(x) === 3) cols.add((file(s) + rank(s)) & 1) }); return cols.size === 1
  }
  return false
}
export type End = { over: false } | { over: true; result: 'mate' | 'stalemate' | 'insufficient' | 'fifty' | 'repetition' | 'resign' | 'cap'; winner: 1 | -1 | 0 }
export function ending(p: Pos, keys: string[]): End {
  const moves = legal(p)
  if (moves.length === 0) return inCheck(p) ? { over: true, result: 'mate', winner: (-p.turn) as 1 | -1 } : { over: true, result: 'stalemate', winner: 0 }
  if (insufficient(p)) return { over: true, result: 'insufficient', winner: 0 }
  if (p.half >= 100) return { over: true, result: 'fifty', winner: 0 }
  const k = key(p)
  if (keys.filter((x) => x === k).length >= 3) return { over: true, result: 'repetition', winner: 0 }
  return { over: false }
}
export function perft(p: Pos, depth: number): number {
  if (depth === 0) return 1
  const ms = legal(p)
  if (depth === 1) return ms.length
  let n = 0
  for (const m of ms) n += perft(play(p, m), depth - 1)
  return n
}

// ---------------------------------------------------------------- a small computer opponent
const VALUE = [0, 100, 320, 330, 500, 900, 0]
const CENTER = (s: number) => 3.5 - Math.max(Math.abs(file(s) - 3.5), Math.abs(rank(s) - 3.5)) // 0..3 towards the middle
export function evaluate(p: Pos): number {
  let score = 0
  for (let s = 0; s < 64; s++) {
    const x = p.b[s]; if (!x) continue
    const t = Math.abs(x), c = Math.sign(x), r = c === 1 ? rank(s) : 7 - rank(s)
    let v = VALUE[t]
    if (t === 1) v += r * 6 + CENTER(s) * 4 + (r >= 5 ? r * 8 : 0)
    else if (t === 2 || t === 3) v += CENTER(s) * 9 - (r === 0 ? 12 : 0)
    else if (t === 5) v += CENTER(s) * 2
    else if (t === 6) v += (r === 0 ? 8 : -CENTER(s) * 4) * (p.b.filter((y) => Math.abs(y) === 5).length ? 1 : -0.5)
    score += c * v
  }
  return score * p.turn
}
const order = (p: Pos, ms: Move[]) => ms.map((m) => ({ m, k: (p.b[m.to] ? 10 * VALUE[Math.abs(p.b[m.to])] - VALUE[Math.abs(p.b[m.from])] : 0) + (m.promo ? 800 : 0) + (m.castle ? 30 : 0) })).sort((a, b) => b.k - a.k).map((x) => x.m)
function search(p: Pos, depth: number, alpha: number, beta: number, budget: { n: number }): number {
  if (budget.n-- <= 0) return evaluate(p)
  const ms = legal(p)
  if (ms.length === 0) return inCheck(p) ? -100000 - depth : 0
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
/** the computer's move: a search of `depth` half-moves (1 = it only looks at its own move) with a little noise so games differ */
export function bestMove(p: Pos, depth: number, noise = 8): Move | null {
  const ms = legal(p)
  if (!ms.length) return null
  const budget = { n: 60000 }
  const scored = order(p, ms).map((m) => ({ m, v: -search(play(p, m), Math.max(0, depth - 1), -Infinity, Infinity, budget) + (Math.random() - 0.5) * noise }))
  scored.sort((a, b) => b.v - a.v)
  return scored[0].m
}
