import { Table } from '../src/engine/table'
import type { RuleId } from '../src/engine/rules'

/** The coach must only ever suggest legal moves. A human who always follows the coach plays whole matches without a rejected move. */
let fails = 0
const ok = (n: string, c: boolean, extra = '') => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', n, c ? '' : extra) }
let suggestions = 0, followed = 0

function play(rule: RuleId, players: 3 | 4) {
  const t = new Table({ rule, aka: true, rounds: 1, minFan: rule === 'mcr' ? 8 : rule === 'hk' ? 1 : 0, players, botLevel: 'normal', swap: false })
  t.speed = 0; t.randomize = true
  t.join('human', 'Me')
  t.start('human')
  let guard = 0
  while (t.game && t.game.phase !== 'over' && guard++ < 30000) {
    const g = t.game
    const you = t.seatOf('human')
    const v = t.view('human').game!
    if (g.phase === 'swap' || g.phase === 'void') { /* bots + timers handle these when the human is idle */ }
    if (g.phase === 'result') { t.ack('human'); continue }
    if (g.phase === 'turn' && g.turn === you) {
      const o = g.turnOptions(you)
      const c = v.coach
      if (!c) { ok(`${rule}: a coach suggestion exists on my turn`, false); break }
      suggestions++
      if (c.kind === 'tsumo') { if (!o.tsumo) { ok(`${rule}: coach says tsumo but it is not available`, false); break } t.turnAction('human', { type: 'tsumo' }) }
      else if (c.kind === 'discard' || c.kind === 'riichi') {
        if (c.tile === undefined || !o.discard.includes(c.tile)) { ok(`${rule}: coach suggested an illegal discard ${c.tile}`, false); break }
        if (c.kind === 'riichi' && !o.riichi.includes(c.tile)) { ok(`${rule}: coach suggested riichi on a tile that cannot declare`, false); break }
        t.turnAction('human', { type: 'discard', tile: c.tile, riichi: c.kind === 'riichi' })
      } else if (c.kind === 'nuki') { if (!o.nuki) { ok(`${rule}: coach says nuki but it is not available`, false); break } t.turnAction('human', { type: 'nuki' }) }
      else if (c.kind === 'kan') {
        if (c.call === 'ankan') { const k = c.tile !== undefined ? c.tile >> 2 : -1; if (!o.ankan.includes(k)) { ok(`${rule}: coach suggested an unavailable closed kan`, false); break } t.turnAction('human', { type: 'ankan', kind: k }) }
        else { if (c.tile === undefined || !o.kakan.includes(c.tile)) { ok(`${rule}: coach suggested an unavailable added kan`, false); break } t.turnAction('human', { type: 'kakan', tile: c.tile }) }
      } else { ok(`${rule}: unexpected coach kind ${c.kind} on my turn`, false); break }
      followed++
    } else if (g.phase === 'reaction' && g.reactions[you] && !g.decisions[you]) {
      const r = g.reactions[you]
      const c = v.coach
      if (!c) { ok(`${rule}: a coach suggestion exists for a reaction`, false); break }
      suggestions++
      if (c.kind === 'ron') { if (!r.ron) { ok(`${rule}: coach says ron but it is not available`, false); break } t.decide('human', { type: 'ron' }) }
      else if (c.kind === 'pass') t.decide('human', { type: 'pass' })
      else if (c.kind === 'call') {
        const d = c.call === 'pon' ? { type: 'pon' as const } : c.call === 'minkan' ? { type: 'minkan' as const } : { type: 'chi' as const, use: r.chi[0] }
        if ((c.call === 'pon' && !r.pon) || (c.call === 'minkan' && !r.minkan) || (c.call === 'chi' && !r.chi.length)) { ok(`${rule}: coach suggested an unavailable call ${c.call}`, false); break }
        t.decide('human', d)
      } else { ok(`${rule}: unexpected coach kind ${c.kind} in a reaction`, false); break }
      followed++
    } else {
      // let the bots / timers move: drive() is called by every action, so just nudge it
      t.drive()
      if (!(g.phase === 'turn' && g.turn === you) && !(g.phase === 'reaction' && g.reactions[you] && !g.decisions[you]) && (g.phase as string) !== 'result') { t.drive(); }
    }
  }
  ok(`${rule}/${players}p: a match played only on coach advice finished (${guard} steps)`, !!t.game && t.game.phase === 'over' && guard < 30000)
  ok(`${rule}/${players}p: the integrity audit stayed clean`, t.auditProblems.length === 0, t.auditProblems.join(' | '))
}
for (let i = 0; i < 3; i++) for (const [rule, pl] of [['taiwan', 4], ['hk', 4], ['riichi', 4], ['riichi', 3], ['mcr', 4]] as [RuleId, 3 | 4][]) play(rule, pl)
console.log(`${suggestions} suggestions checked, ${followed} followed`)
console.log(fails ? `\n${fails} FAILED` : '\ncoach suggestions are always legal')
process.exit(fails ? 1 : 0)
