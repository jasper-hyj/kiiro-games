import { Table } from '../../src/games/mahjong/engine/table'

/** Seats and the first East must be random every game, not "the host first". */
let fails = 0
const check = (n: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra)
}
const hostSeat = new Map<number, number>()
const dealers = new Map<number, number>()
const eastIsHost = { n: 0 }
const N = 400
for (let i = 0; i < N; i++) {
  const t = new Table({ rule: 'taiwan', aka: true, rounds: 1, minFan: 1, players: 4, botLevel: 'normal' })
  t.speed = 0
  t.join('host', 'Host')
  t.join('g1', 'G1')
  t.start('host')
  const hs = t.seatOf('host')
  hostSeat.set(hs, (hostSeat.get(hs) ?? 0) + 1)
  const d = t.game!.dealer
  dealers.set(d, (dealers.get(d) ?? 0) + 1)
  if (d === hs) eastIsHost.n++
  if (t.seatOf('g1') === hs || t.seatOf('g1') < 0) check('players never share a seat', false)
}
check(
  `the host lands in every seat over ${N} games (${[...hostSeat.entries()]
    .sort()
    .map(([s, c]) => `${s}:${c}`)
    .join(' ')})`,
  hostSeat.size === 4 && [...hostSeat.values()].every((c) => c > N * 0.15),
)
check(
  `the first dealer is spread over all four seats (${[...dealers.entries()]
    .sort()
    .map(([s, c]) => `${s}:${c}`)
    .join(' ')})`,
  dealers.size === 4 && [...dealers.values()].every((c) => c > N * 0.15),
)
check(`the host is East only about a quarter of the time (${eastIsHost.n}/${N})`, eastIsHost.n > N * 0.15 && eastIsHost.n < N * 0.35)
console.log(fails ? `\n${fails} FAILED` : '\nseating is random')
process.exit(fails ? 1 : 0)
