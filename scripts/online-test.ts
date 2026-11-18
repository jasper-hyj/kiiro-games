import PartySocket from 'partysocket'
import type { TableView } from '../src/engine/table'

const host = 'localhost:8787'
const room = 'test' + Math.floor(Math.random() * 1e6)
const mk = (id: string, name: string, create = false) => {
  const c = { view: null as TableView | null, errors: [] as string[], ws: new PartySocket({ host, room, WebSocket: WebSocket as any }) }
  c.ws.addEventListener('open', () => c.ws.send(JSON.stringify({ t: 'join', id, name, ...(create ? { create: true } : {}) })))
  c.ws.addEventListener('message', (e: any) => { const m = JSON.parse(e.data); if (m.t === 'view') c.view = m.view; else c.errors.push(m.message) })
  return c
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (n: string, ok: boolean) => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', n) }

const a = mk('idA', 'Alice', true); await wait(800)
const b = mk('idB', 'Bob'); await wait(800)
check('lobby: both seated', a.view?.seats.filter((s) => s.human).length === 2 && b.view?.you === 1)
check('first joiner is host', a.view?.host === true && b.view?.host === false)
b.ws.send(JSON.stringify({ t: 'config', config: { rule: 'riichi' } })); await wait(300)
check('non-host cannot change config', a.view?.config.rule === 'taiwan')
a.ws.send(JSON.stringify({ t: 'config', config: { rule: 'hk', rounds: 1 } })); await wait(300)
check('host can change config', b.view?.config.rule === 'hk')
a.ws.send(JSON.stringify({ t: 'start' })); await wait(1500)
const ga = a.view?.game, gb = b.view?.game
check('game started', !!ga && !!gb)
// seats are shuffled when the game starts, so use each client's own seat
const sa = a.view!.you, sb = b.view!.you
check('own hand visible, others hidden', !!ga!.players[sa].hand && ga!.players[sb].hand === null && !!gb!.players[sb].hand && gb!.players[sa].hand === null)
check('hand size 13 (+flowers/draw)', ga!.players[sa].hand!.length >= 12)
// play: whoever's turn it is discards; passes on reactions; run for a while
let turns = 0
for (let i = 0; i < 400; i++) {
  for (const [c] of [[a, 0], [b, 1]] as const) {
    const g = c.view?.game
    if (!g) continue
    if (g.turnOptions && g.turnOptions.discard.length) { c.ws.send(JSON.stringify({ t: 'act', a: g.turnOptions.tsumo ? { type: 'tsumo' } : { type: 'discard', tile: g.turnOptions.discard[g.turnOptions.discard.length - 1] } })); turns++ }
    else if (g.reaction) c.ws.send(JSON.stringify({ t: 'decide', d: { type: g.reaction.ron ? 'ron' : 'pass' } }))
    else if (g.phase === 'result') c.ws.send(JSON.stringify({ t: 'ack' }))
  }
  await wait(60)
}
check(`humans played ${turns} turns without desync`, turns > 10)
// disconnect Bob -> bot takes over, game continues
const before = a.view!.game!.handNo
b.ws.close(); await wait(3000)
check('disconnected seat marked away', a.view!.seats[sb].connected === false)
// rejoin
const b2 = mk('idB', 'Bob'); await wait(1000)
check('rejoin reclaims same seat', b2.view?.you === sb && b2.view?.status === 'playing')
const c3 = mk('idC', 'Carol'); await wait(1000)
check('late joiner takes over a bot seat mid-game', c3.view?.you !== undefined && c3.view.you !== sa && c3.view.you !== sb)
// room codes: nobody can land in a random empty room by typing a wrong code, and codes in use cannot be created again
const ghost = mk('idG', 'Ghost'); await wait(800)
check('joining a code nobody created is refused (room_not_found)', ghost.errors.includes('room_not_found') && !ghost.view)
const room2 = new PartySocket({ host, room, WebSocket: WebSocket as any }); const e2: string[] = []
room2.addEventListener('open', () => room2.send(JSON.stringify({ t: 'join', id: 'idH', name: 'H', create: true })))
room2.addEventListener('message', (e: any) => { const m = JSON.parse(e.data); if (m.t === 'error') e2.push(m.message) })
await wait(800)
check('creating a room on a code that is in use is refused (code_taken)', e2.includes('code_taken'))
console.log('errors', a.errors, c3.errors, 'hands', before, a.view!.game!.handNo)
process.exit(fails ? 1 : 0)
