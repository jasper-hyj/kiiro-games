import { Game } from '../../src/games/mahjong/engine/game'
import { botReact, botTurn } from '../../src/games/mahjong/engine/bot'
import type { RuleId } from '../../src/games/mahjong/engine/rules'

/** Seats 0+2 play 'normal', seats 1+3 play 'easy' (rotated each game so seating luck cancels). */
const [A, B] = (process.env.LV ?? 'normal,easy').split(',') as ['normal' | 'hard', 'easy' | 'normal']
const N = Number(process.argv[2] ?? 40)
const rules = (process.argv[3] ? [process.argv[3]] : ['taiwan', 'riichi', 'hk']) as RuleId[]

for (const rule of rules) {
  let normal = 0,
    easy = 0,
    nWins = 0,
    eWins = 0,
    games = 0
  const t0 = Date.now()
  for (let n = 0; n < N; n++) {
    const g = new Game(rule, { rule, aka: true, rounds: 1, minFan: rule === 'mcr' ? 8 : 3 } as never, ['A', 'B', 'C', 'D'])
    const rot = n % 4
    const level = (seat: number) => ((seat + rot) % 2 === 0 ? A : B) as 'normal' | 'easy' | 'hard'
    let guard = 0
    while ((g.phase as string) !== 'over' && guard++ < 60000) {
      if (g.phase === 'turn') g.act(g.turn, botTurn(g, g.turn, level(g.turn)))
      else if (g.phase === 'reaction') {
        for (const s of g.pendingSeats()) if (g.phase === 'reaction') g.submitDecision(s, botReact(g, s, level(s)))
      } else if (g.phase === 'result') {
        const r = g.result!
        if (r.kind === 'win')
          for (const w of [r.winner!, ...(r.others?.map((o) => o.winner) ?? [])]) {
            if (level(w) === A) nWins++
            else eWins++
          }
        g.next()
      }
    }
    g.players.forEach((p, s) => {
      if (level(s) === A) normal += p.points - g.rule.startPoints
      else easy += p.points - g.rule.startPoints
    })
    games++
  }
  console.log(
    `${rule}: ${games} games (${Math.round((Date.now() - t0) / 1000)}s)  normal bots: ${(normal / games / 2).toFixed(0)} pts/seat/game, ${nWins} wins | easy bots: ${(easy / games / 2).toFixed(0)} pts/seat/game, ${eWins} wins`,
  )
}
