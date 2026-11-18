import { Table } from '../src/engine/table'
import { kindOf } from '../src/engine/tiles'
import type { RuleId } from '../src/engine/rules'

/** A human who calls chi / pon / kan at random moments while bots react on timers: every meld must stay legal and the audit clean. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let bad = 0, melds = 0
const fail = (m: string) => { bad++; if (bad < 20) console.log('FAIL', m) }

async function play(rule: RuleId) {
  const t = new Table({ rule, aka: true, rounds: 1, minFan: 0, players: 4, botLevel: 'hard', swap: false } as never)
  t.speed = 0.01; t.randomize = true
  t.join('h', 'Me'); t.start('h')
  const seen = new Set<string>()
  for (let guard = 0; guard < 4000 && t.game && t.game.phase !== 'over'; guard++) {
    const g = t.game
    const you = t.seatOf('h')
    if (g.phase === 'result') { t.ack('h'); continue }
    if (g.phase === 'turn' && g.turn === you) { const o = g.turnOptions(you); t.turnAction('h', o.tsumo ? { type: 'tsumo' } : { type: 'discard', tile: o.discard[Math.floor(Math.random() * o.discard.length)] }) }
    else if (g.phase === 'reaction' && g.reactions[you] && !g.decisions[you]) {
      const r = g.reactions[you]
      if (Math.random() < 0.3) await sleep(Math.random() * 30)
      if (g.phase === 'reaction' && g.reactions[you] && !g.decisions[you]) {
        const opts: Parameters<Table['decide']>[1][] = [{ type: 'pass' }]
        if (r.ron) opts.push({ type: 'ron' })
        if (r.pon) opts.push({ type: 'pon' }, { type: 'pon' })
        if (r.minkan) opts.push({ type: 'minkan' })
        for (const c of r.chi) opts.push({ type: 'chi', use: c }, { type: 'chi', use: c })
        t.decide('h', opts[Math.floor(Math.random() * opts.length)])
      }
    }
    await sleep(2)
    for (const p of g.players) {
      const ids = [...p.hand, ...p.melds.flatMap((m) => m.tiles)]
      if (new Set(ids).size !== ids.length) fail(`${rule}: seat ${p.seat} holds a tile twice`)
      for (const m of p.melds) {
        const key = `${g.handNo}:${p.seat}:${m.tiles.join(',')}`
        if (seen.has(key)) continue
        seen.add(key); melds++
        const ks = m.tiles.map(kindOf).sort((a, b) => a - b)
        if (new Set(m.tiles).size !== m.tiles.length) fail(`${rule}: ${m.type} with a repeated tile ${m.tiles}`)
        if (m.type === 'chi' && !(ks[1] === ks[0] + 1 && ks[2] === ks[1] + 1)) fail(`${rule}: illegal chi ${ks}`)
        if (m.type === 'pon' && new Set(ks).size !== 1) fail(`${rule}: illegal pon ${ks}`)
      }
    }
  }
  if (t.auditProblems.length) fail(`${rule}: audit ${t.auditProblems.slice(0, 3).join(' | ')}`)
}
for (let i = 0; i < 6; i++) for (const rule of ['taiwan', 'hk', 'riichi'] as RuleId[]) await play(rule)
console.log(`${melds} melds checked, ${bad} problems`)
process.exit(bad ? 1 : 0)
