import { Game } from '../../src/games/mahjong/engine/game'
import { botReact, botTurn } from '../../src/games/mahjong/engine/bot'
import type { RuleId } from '../../src/games/mahjong/engine/rules/types'

/** Is the whole game fair? Many single hands between four identical bots: every seat should win, draw and deal in equally often (chi-square, fails only at p < 0.001). */
const HANDS = Number(process.argv[2] ?? 1200)
let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`)
}
const CRIT3 = 16.27 // chi-square, 3 degrees of freedom, p = 0.001
const chi = (obs: number[]) => {
  const e = obs.reduce((a, b) => a + b, 0) / obs.length
  return e === 0 ? 0 : obs.reduce((a, o) => a + (o - e) ** 2 / e, 0)
}

for (const [rule, label] of [
  ['hk', 'Hong Kong'],
  ['taiwan', 'Taiwanese'],
  ['riichi', 'Riichi'],
  ['mcr', 'MCR'],
] as [RuleId, string][]) {
  const wins = [0, 0, 0, 0],
    tsumo = [0, 0, 0, 0],
    pays = [0, 0, 0, 0],
    shanten = [0, 0, 0, 0],
    draws: number[] = []
  let played = 0,
    drawn = 0
  for (let h = 0; h < HANDS; h++) {
    const g = new Game(rule, { rule, aka: true, rounds: 1, minFan: rule === 'mcr' ? 8 : rule === 'hk' ? 1 : 0, swap: false, fixedDealer: false } as never, [
      'A',
      'B',
      'C',
      'D',
    ])
    for (const p of g.players) shanten[p.seat] += g.shanten(p.seat)
    let guard = 0
    while ((g.phase as string) !== 'result' && (g.phase as string) !== 'over' && guard++ < 4000) {
      if (g.phase === 'turn') {
        const s = g.turn
        if (!g.act(s, botTurn(g, s, 'normal'))) {
          const o = g.turnOptions(s)
          g.act(s, { type: 'discard', tile: o.discard[o.discard.length - 1] })
        }
      } else if (g.phase === 'reaction') {
        for (const s of g.pendingSeats()) if (g.phase === 'reaction') g.submitDecision(s, botReact(g, s, 'normal'))
      } else break
    }
    const r = g.result
    if (!r) continue
    played++
    if (r.kind === 'win') {
      for (const w of [r.winner!, ...(r.others?.map((o) => o.winner) ?? [])]) wins[w]++
      if (r.tsumo) tsumo[r.winner!]++
      else if (r.from !== null && r.from !== undefined) pays[r.from]++
    } else drawn++
  }
  console.log(
    `${label}: ${played} hands, ${wins.reduce((a, b) => a + b, 0)} wins (${((100 * wins.reduce((a, b) => a + b, 0)) / played).toFixed(1)}%), ${drawn} draws; wins by seat ${wins.join('/')}, tsumo ${tsumo.join('/')}, discarded into a win ${pays.join('/')}`,
  )
  const sumSh = shanten.map((x) => (x / played).toFixed(3))
  const mean = shanten.reduce((a, b) => a + b, 0) / 4 / played
  check(
    `${label}: no seat starts with a better hand on average (starting shanten ${sumSh.join(' / ')})`,
    shanten.every((x) => Math.abs(x / played - mean) < 0.12),
  )
  check(`${label}: every seat wins equally often`, chi(wins) < CRIT3, `(chi2 ${chi(wins).toFixed(1)}, limit ${CRIT3})`)
  if (tsumo.reduce((a, b) => a + b, 0) > 40)
    check(`${label}: every seat wins by self-draw equally often`, chi(tsumo) < CRIT3, `(chi2 ${chi(tsumo).toFixed(1)})`)
  if (pays.reduce((a, b) => a + b, 0) > 40) check(`${label}: every seat deals into wins equally often`, chi(pays) < CRIT3, `(chi2 ${chi(pays).toFixed(1)})`)
  void draws
  void drawn
}
console.log(fails ? `${fails} FAILED` : 'whole-game fairness checks passed')
process.exit(fails ? 1 : 0)
