import PartySocket from 'partysocket'
import type { TableView } from '../../src/games/mahjong/engine/table'

/** Against `wrangler dev`: a player who never acts is marked slow, then auto; "I'm here" ({ t: 'here' }) clears it. Takes about 70 s (30 s turn timer). */
const room = 'idle' + Math.floor(Math.random() * 1e6)
let view: TableView | null = null
const ws = new PartySocket({ host: 'localhost:8787', room, WebSocket: WebSocket as any })
ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'join', id: 'idleA', name: 'Idle', create: true })))
ws.addEventListener('message', (e: any) => { const m = JSON.parse(e.data); if (m.t === 'view') view = m.view })
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (n: string, ok: boolean) => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', n) }
const mine = () => view?.game?.players[view.you]?.idle

await wait(800)
ws.send(JSON.stringify({ t: 'start' }))
let sawSlow = false, sawAuto = false
for (let i = 0; i < 160 && !sawAuto; i++) { await wait(1000); const x = mine(); if (x === 'slow') sawSlow = true; if (x === 'auto') sawAuto = true }
check('first timeout is shown as slow', sawSlow)
check('second timeout is shown as auto', sawAuto)
ws.send(JSON.stringify({ t: 'here' }))
await wait(1200)
check("'I'm here' clears the idle state", mine() === undefined)
ws.close()
process.exit(fails ? 1 : 0)
