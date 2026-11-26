import { Game } from '../../src/games/mahjong/engine/game'
import { freshWall } from '../../src/games/mahjong/engine/tiles'
import { kindOf } from '../../src/games/mahjong/engine/tiles'

/** Is the deal fair? Statistical checks (chi-square) on the shuffle and on what each seat is dealt. Fails only on very unlikely results (p < 0.001). */
let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`)
}
const chi = (observed: number[], expected: number) => observed.reduce((a, o) => a + (o - expected) ** 2 / expected, 0)
// critical values at p = 0.001 for df = 7, 33, 3
const CRIT: Record<number, number> = { 3: 16.27, 7: 24.32, 33: 62.49 }

const N = 20000
{
  // 1. every tile is equally likely to land anywhere in the shuffled wall
  const len = freshWall(false).length
  const buckets = 8
  for (const id of [0, 57, 123]) {
    const obs = new Array(buckets).fill(0)
    for (let n = 0; n < N; n++) {
      const w = freshWall(false)
      obs[Math.floor((w.indexOf(id) * buckets) / len)]++
    }
    const x = chi(obs, N / buckets)
    check(`tile ${id} is equally likely in every part of the wall`, x < CRIT[7], `(chi2 ${x.toFixed(1)}, limit ${CRIT[7]})`)
  }
  // dragons: share of the first 13 tiles
  const w0 = freshWall(false)
  check('wall has 136 tiles and every tile once', w0.length === 136 && new Set(w0).size === 136)
}

for (const [rule, players, label] of [
  ['riichi', 4, 'Riichi'],
  ['hk', 4, 'Hong Kong'],
  ['taiwan', 4, 'Taiwanese'],
  ['hk', 3, 'Hong Kong 3p'],
] as const) {
  // 2. what each seat is dealt: tile kinds in the starting hand, by seat
  const names = Array.from({ length: players }, (_, i) => 'P' + i)
  const kinds = 34
  const perSeat: number[][] = Array.from({ length: players }, () => new Array(kinds).fill(0))
  const honors = new Array(players).fill(0)
  const games = 6000
  for (let g = 0; g < games; g++) {
    const game = new Game(rule, { aka: true, rounds: 1, minFan: 0, players, fixedDealer: false } as never, names)
    for (const p of game.players)
      for (const id of p.hand) {
        const k = kindOf(id)
        if (k < 34) {
          perSeat[p.seat][k]++
          if (k >= 27) honors[p.seat]++
        }
      }
  }
  const mean = honors.reduce((a, b) => a + b, 0) / players
  const spread = Math.max(...honors.map((h) => Math.abs(h - mean) / mean))
  check(`${label}: every seat is dealt the same number of honor tiles on average`, spread < 0.03, `(max deviation ${(spread * 100).toFixed(2)}%)`)
  // chi-square of each seat's kind distribution against the pooled distribution
  const pooled = new Array(kinds).fill(0)
  for (const s of perSeat) s.forEach((v, k) => (pooled[k] += v))
  const totalAll = pooled.reduce((a, b) => a + b, 0)
  let worst = 0
  perSeat.forEach((s) => {
    const tot = s.reduce((a, b) => a + b, 0)
    const present = pooled.map((v, k) => ({ v, k })).filter((x) => x.v > 0)
    const x = present.reduce((a, { v, k }) => {
      const e = (v / totalAll) * tot
      return a + (s[k] - e) ** 2 / e
    }, 0)
    worst = Math.max(worst, (x / (present.length - 1)) * 33)
  })
  check(`${label}: no seat gets a different mix of tiles than the others`, worst < CRIT[33] * 1.6, `(scaled chi2 ${worst.toFixed(1)})`)
}
console.log(fails ? `${fails} FAILED` : 'deal fairness checks passed')
process.exit(fails ? 1 : 0)
