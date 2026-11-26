/** Cards are 0..51: rank = c % 13 (0 = deuce ... 12 = ace), suit = floor(c / 13) (0 spades, 1 hearts, 2 diamonds, 3 clubs). */
export const rankOf = (c: number) => c % 13
export const suitOf = (c: number) => Math.floor(c / 13)
export const RANKS = '23456789TJQKA'
export const SUITS = '♠♥♦♣'

/** A fresh shuffled deck (Fisher-Yates driven by the platform's secure random numbers). */
export function shuffled(rand: (n: number) => number = secureInt): number[] {
  const d = Array.from({ length: 52 }, (_, i) => i)
  for (let i = d.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}
/** Uniform integer in [0, n) without modulo bias. */
export function secureInt(n: number): number {
  const lim = Math.floor(0x100000000 / n) * n
  const a = new Uint32Array(1)
  do {
    crypto.getRandomValues(a)
  } while (a[0] >= lim)
  return a[0] % n
}
