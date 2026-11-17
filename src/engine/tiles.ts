// Tile ids: 0..135 = 34 kinds x 4 copies (kind = id >> 2). 136..143 = 8 flowers.
// Kinds: 0-8 man, 9-17 pin, 18-26 sou, 27-30 winds (E S W N), 31 white, 32 green, 33 red.
// Flower kinds: 34-37 plum/orchid/chrysanthemum/bamboo, 38-41 spring/summer/autumn/winter.
export const NUM_KINDS = 34
export const FLOWER_BASE = 34
export const WHITE = 31, GREEN = 32, RED = 33

export const kindOf = (id: number) => (id >= 136 ? FLOWER_BASE + (id - 136) : id >> 2)
export const isFlowerId = (id: number) => id >= 136
export const isFlowerKind = (k: number) => k >= FLOWER_BASE
export const suitOf = (k: number) => (k >= 27 ? 3 : Math.floor(k / 9)) // 0 man 1 pin 2 sou 3 honor
export const numOf = (k: number) => (k >= 27 ? 0 : (k % 9) + 1)
export const isHonor = (k: number) => k >= 27 && k < 34
export const isDragon = (k: number) => k >= 31 && k < 34
export const isWind = (k: number) => k >= 27 && k < 31
export const isTerminal = (k: number) => k < 27 && (k % 9 === 0 || k % 9 === 8)
export const isTermOrHonor = (k: number) => isTerminal(k) || isHonor(k)
export const isSimple = (k: number) => k < 27 && !isTerminal(k)
export const isRedFive = (id: number) => id < 136 && (id & 3) === 0 && (id >> 2 === 4 || id >> 2 === 13 || id >> 2 === 22)
export const flowerSeat = (k: number) => (k - FLOWER_BASE) % 4 // matching seat wind index

/** Dora kind that an indicator points to. */
export function doraFrom(ind: number, sanma = false): number {
  if (sanma && ind < 9) return ind === 0 ? 8 : 0 // only 1m and 9m exist
  if (ind < 27) return ind % 9 === 8 ? ind - 8 : ind + 1
  if (ind < 31) return ind === 30 ? 27 : ind + 1
  return ind === 33 ? 31 : ind + 1
}

export const sortIds = (ids: number[]) => ids.sort((a, b) => kindOf(a) - kindOf(b) || a - b)

export function freshWall(withFlowers: boolean, sanma = false): number[] {
  const n = withFlowers ? 144 : 136
  let w = Array.from({ length: n }, (_, i) => i)
  if (sanma) w = w.filter((id) => id >= 136 || id >> 2 === 0 || id >> 2 > 7) // drop 2m-8m
  for (let i = w.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[w[i], w[j]] = [w[j], w[i]]
  }
  return w
}

const SUITS = ['m', 'p', 's']
export function kindName(k: number): string {
  if (k < 27) return `${numOf(k)}${SUITS[suitOf(k)]}`
  return ['East', 'South', 'West', 'North', 'White', 'Green', 'Red'][k - 27] ?? `F${k - 33}`
}
