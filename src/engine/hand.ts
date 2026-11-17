import { NUM_KINDS, suitOf, numOf, isTermOrHonor } from './tiles'

export type Counts = number[]
export interface SetInfo { type: 'seq' | 'tri'; kind: number; open?: boolean; kan?: boolean }
export interface Decomp { sets: SetInfo[]; pair: number }

export const emptyCounts = (): Counts => new Array(NUM_KINDS).fill(0)
export function toCounts(kinds: number[]): Counts {
  const c = emptyCounts()
  for (const k of kinds) if (k < NUM_KINDS) c[k]++
  return c
}
const canSeq = (k: number) => k < 27 && numOf(k) <= 7

/** All ways to split counts into exactly `n` sets (no pair). */
function setsOf(c: Counts, n: number, from: number, acc: SetInfo[], out: SetInfo[][]) {
  if (n === 0) {
    for (let i = from; i < NUM_KINDS; i++) if (c[i]) return
    out.push(acc.slice())
    return
  }
  let i = from
  while (i < NUM_KINDS && c[i] === 0) i++
  if (i >= NUM_KINDS) return
  if (c[i] >= 3) {
    c[i] -= 3; acc.push({ type: 'tri', kind: i })
    setsOf(c, n - 1, i, acc, out)
    acc.pop(); c[i] += 3
  }
  if (canSeq(i) && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--; acc.push({ type: 'seq', kind: i })
    setsOf(c, n - 1, i, acc, out)
    acc.pop(); c[i]++; c[i + 1]++; c[i + 2]++
  }
}

export function decompose(counts: Counts, nSets: number): Decomp[] {
  const c = counts.slice()
  const res: Decomp[] = []
  for (let p = 0; p < NUM_KINDS; p++) {
    if (c[p] < 2) continue
    c[p] -= 2
    const out: SetInfo[][] = []
    setsOf(c, nSets, 0, [], out)
    for (const sets of out) res.push({ sets, pair: p })
    c[p] += 2
  }
  return res
}

function canSets(c: Counts, from: number): boolean {
  let i = from
  while (i < NUM_KINDS && c[i] === 0) i++
  if (i >= NUM_KINDS) return true
  if (c[i] >= 3) { c[i] -= 3; const r = canSets(c, i); c[i] += 3; if (r) return true }
  if (canSeq(i) && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--
    const r = canSets(c, i)
    c[i]++; c[i + 1]++; c[i + 2]++
    if (r) return true
  }
  return false
}
export function canComplete(counts: Counts): boolean {
  const c = counts.slice()
  for (let p = 0; p < NUM_KINDS; p++) {
    if (c[p] < 2) continue
    c[p] -= 2
    const ok = canSets(c, 0)
    c[p] += 2
    if (ok) return true
  }
  return false
}

export const KOKUSHI = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
export const isChiitoi = (c: Counts) => c.reduce((a, v) => a + (v === 2 ? 1 : 0), 0) === 7 && c.every((v) => v === 0 || v === 2)
export function isKokushi(c: Counts) {
  let pair = false
  for (const k of KOKUSHI) { if (c[k] === 0) return false; if (c[k] === 2) pair = true }
  return pair && c.reduce((a, v) => a + v, 0) === 14
}

export interface Special { chiitoi?: boolean; kokushi?: boolean }
export function isComplete(c: Counts, special: Special = {}): boolean {
  if (canComplete(c)) return true
  if (special.chiitoi && isChiitoi(c)) return true
  if (special.kokushi && isKokushi(c)) return true
  return false
}

/** Tiles (kinds) that would complete a hand of 3n+1 concealed tiles. */
export function waitsOf(c: Counts, special: Special = {}): number[] {
  const res: number[] = []
  for (let k = 0; k < NUM_KINDS; k++) {
    if (c[k] >= 4) continue
    c[k]++
    if (isComplete(c, special)) res.push(k)
    c[k]--
  }
  return res
}

/** Standard-form shanten. `melds` = number of fixed sets; N = sets in a full hand. */
export function shantenStd(counts: Counts, melds: number, N: number): number {
  const c = counts.slice()
  let best = 2 * N
  let m = melds, t = 0, pair = false
  const evalNow = () => {
    let tt = t
    if (m + tt > N) tt = N - m
    const s = 2 * N - 2 * m - tt - (pair ? 1 : 0)
    if (s < best) best = s
  }
  const dfs = (i: number) => {
    while (i < NUM_KINDS && c[i] === 0) i++
    if (i >= NUM_KINDS) return evalNow()
    if (best <= -1) return
    const seqOk = canSeq(i)
    if (c[i] >= 3) { c[i] -= 3; m++; dfs(i); m--; c[i] += 3 }
    if (seqOk && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; m++; dfs(i); m--; c[i]++; c[i + 1]++; c[i + 2]++
    }
    if (c[i] >= 2) {
      if (!pair) { pair = true; c[i] -= 2; dfs(i); c[i] += 2; pair = false }
      c[i] -= 2; t++; dfs(i); t--; c[i] += 2
    }
    if (i < 27 && numOf(i) <= 8 && c[i + 1] > 0) { c[i]--; c[i + 1]--; t++; dfs(i); t--; c[i]++; c[i + 1]++ }
    if (seqOk && c[i + 2] > 0) { c[i]--; c[i + 2]--; t++; dfs(i); t--; c[i]++; c[i + 2]++ }
    c[i]--; dfs(i); c[i]++
  }
  dfs(0)
  return best
}

export function shantenChiitoi(c: Counts): number {
  let pairs = 0, kinds = 0
  for (const v of c) { if (v >= 2) pairs++; if (v >= 1) kinds++ }
  return 6 - pairs + Math.max(0, 7 - kinds)
}
export function shantenKokushi(c: Counts): number {
  let n = 0, pair = 0
  for (const k of KOKUSHI) { if (c[k]) n++; if (c[k] >= 2) pair = 1 }
  return 13 - n - pair
}
export function shantenAll(c: Counts, melds: number, N: number, special: Special): number {
  let s = shantenStd(c, melds, N)
  if (melds === 0 && special.chiitoi) s = Math.min(s, shantenChiitoi(c))
  if (melds === 0 && special.kokushi) s = Math.min(s, shantenKokushi(c))
  return s
}

export function suitCounts(c: Counts) {
  const out = [0, 0, 0, 0]
  for (let k = 0; k < NUM_KINDS; k++) out[suitOf(k)] += c[k]
  return out
}
export const allTermHonor = (c: Counts) => c.every((v, k) => v === 0 || isTermOrHonor(k))
