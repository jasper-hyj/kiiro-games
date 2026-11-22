import { Table } from '../../src/games/mahjong/engine/table'
import type { RuleId } from '../../src/games/mahjong/engine/rules'
import { botSwap, botVoid } from '../../src/games/mahjong/engine/bot'

/** A room must survive a server restart: serialize mid-game, restore into a fresh Table, compare, and play on to the end. */
let fails = 0
const check = (n: string, ok: boolean, extra = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra) }
const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

function playSome(t: Table, ids: string[], steps: number) {
  for (let i = 0; i < steps; i++) {
    const g = t.game
    if (!g || g.phase === 'over') return
    if (g.phase === 'result') { for (const id of ids) t.ack(id); continue }
    for (const id of ids) {
      const seat = t.seatOf(id)
      const v = t.view(id).game
      if (!v) continue
      if (v.phase === 'swap' && !v.pick.swap[seat]) { t.swap(id, botSwap(g, seat)); continue }
      if (v.phase === 'void' && !v.pick.void[seat]) { t.pickVoid(id, botVoid(g, seat)); continue }
      if (v.turnOptions && v.turn === seat) {
        const o = v.turnOptions
        if (o.tsumo) t.turnAction(id, { type: 'tsumo' })
        else t.turnAction(id, { type: 'discard', tile: rnd(o.discard) })
      } else if (v.reaction) {
        t.decide(id, v.reaction.ron ? { type: 'ron' } : { type: 'pass' })
      }
    }
  }
}

for (const rule of ['taiwan', 'hk', 'riichi', 'mcr', 'sichuan'] as RuleId[]) {
  for (let round = 0; round < 6; round++) {
    const a = new Table({ rule, aka: true, rounds: 1, minFan: 1, players: 4, botLevel: 'normal' })
    a.speed = 0
    a.join('p1', 'Ann'); a.join('p2', 'Bo')
    a.start('p1')
    playSome(a, ['p1', 'p2'], 25 + round * 15)
    const json = a.serialize()
    const b = new Table({ rule: 'taiwan', aka: false, rounds: 1, minFan: 0, players: 4, botLevel: 'normal' })
    b.speed = 0
    b.restore(json, false) // compare before any bot gets to move
    const same = !!a.game && !!b.game && a.game.serialize() === b.game.serialize()
    check(`${rule} #${round}: restored game state is identical`, same)
    check(`${rule} #${round}: players and host are kept`, b.hostId === 'p1' && b.seatOf('p2') === a.seatOf('p2') && b.slots.filter((s) => s.id).length === 2)
    b.restore(json)
    // the two humans come back and the restored room plays to the end
    b.join('p1', 'Ann'); b.join('p2', 'Bo')
    let guard = 0
    while (b.game && b.game.phase !== 'over' && guard++ < 4000) playSome(b, ['p1', 'p2'], 1)
    check(`${rule} #${round}: restored room finishes the match (${guard} steps)`, !!b.game && b.game.phase === 'over' && guard < 4000)
  }
}
console.log(fails ? `\n${fails} FAILED` : '\nroom persistence ok')
process.exit(fails ? 1 : 0)
