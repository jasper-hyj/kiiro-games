import { Game } from '../src/engine/game'
import { botReact, botTurn } from '../src/engine/bot'
import type { RuleId } from '../src/engine/rules'

const rules: RuleId[] = (process.argv[3] ? [process.argv[3]] : ['riichi', 'hk', 'taiwan']) as RuleId[]
const ROUNDS = Number(process.argv[4] ?? 1)
const N = Number(process.argv[2] ?? 6)
for (const rule of rules) {
  const stats = { games: N, hands: 0, wins: 0, draws: 0, tsumo: 0, yaku: {} as Record<string, number>, maxTotal: 0, riichi: 0 }
  const t0 = Date.now()
  for (let n = 0; n < N; n++) {
    const g = new Game(rule, { rule, aka: true, rounds: ROUNDS, minFan: 3 } as any, ['A', 'B', 'C', 'D'])
    let guard = 0
    while ((g.phase as string) !== 'over' && guard++ < 50000) {
      if (g.phase === 'turn') {
        const a = botTurn(g, g.turn)
        if (!g.act(g.turn, a)) throw new Error('bot made illegal action ' + JSON.stringify(a))
      } else if (g.phase === 'reaction') {
        for (const s of g.pendingSeats()) if (g.phase === 'reaction' && !g.submitDecision(s, botReact(g, s))) throw new Error('illegal decision')
      } else if (g.phase === 'result') {
        const r = g.result!
        stats.hands++
        if (r.kind === 'win') {
          stats.wins++; if (r.others) (stats as any).multiRon = ((stats as any).multiRon ?? 0) + 1; if (r.tsumo) stats.tsumo++
          r.score!.yaku.forEach((y) => (stats.yaku[y.name] = (stats.yaku[y.name] ?? 0) + 1))
          stats.maxTotal = Math.max(stats.maxTotal, r.score!.total)
        } else stats.draws++
        if (r.deltas.reduce((a, b) => a + b, 0) !== (r.sticksWon ?? 0)) throw new Error(`deltas not zero-sum ${r.deltas} ${r.sticksWon}`)
        g.next()
      }
    }
    if (guard >= 50000) throw new Error('infinite loop in ' + rule)
  }
  console.log(rule, `${Date.now() - t0}ms`, JSON.stringify({ ...stats, yaku: Object.entries(stats.yaku).sort((a, b) => b[1] - a[1]).slice(0, 10) }))
}
