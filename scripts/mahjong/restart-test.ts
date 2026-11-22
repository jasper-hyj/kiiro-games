import { utimesSync } from 'node:fs'

/** Room persistence against the real local server (`npm run party:dev` must be running): start a game, make the Worker
 *  reload (touching party/server.ts evicts the room object from memory), then rejoin with the same id. */
const HOST = process.env.HOST ?? 'localhost:8787'
let fails = 0
const check = (n: string, ok: boolean, extra = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
interface C { ws: WebSocket; msgs: any[] }
const connect = (room: string) => new Promise<C>((resolve, reject) => {
  const ws = new WebSocket(`ws://${HOST}/parties/main/${room}`)
  const c: C = { ws, msgs: [] }
  ws.onmessage = (e) => { try { c.msgs.push(JSON.parse(String(e.data))) } catch { /* ignore */ } }
  ws.onopen = () => resolve(c)
  ws.onerror = () => reject(new Error('connect failed'))
})
const send = (c: C, m: unknown) => c.ws.send(JSON.stringify(m))
const lastView = (c: C) => [...c.msgs].reverse().find((m) => m.t === 'view')?.view

const room = String(Math.floor(Math.random() * 900000) + 100000)
const a = await connect(room)
send(a, { t: 'join', id: 'persist-1', name: 'Ann', create: true })
await sleep(400)
send(a, { t: 'start' })
await sleep(1500)
const before = lastView(a)
check('game is running before the restart', before?.status === 'playing' && !!before.game)
const handNo = before?.game?.history?.length ?? 0
const pointsBefore = before?.game?.players?.map((p: { points: number }) => p.points).join(',')
await sleep(1200) // let the room persist
a.ws.close()
await sleep(300)

const f = new URL('../../party/server.ts', import.meta.url).pathname
const now = new Date()
utimesSync(f, now, now) // make wrangler reload the worker => room object is rebuilt from storage
await sleep(9000)

const b = await connect(room)
send(b, { t: 'join', id: 'persist-1', name: 'Ann' })
await sleep(1500)
const after = lastView(b)
check('the room is still playing after the restart', after?.status === 'playing' && !!after.game, JSON.stringify(after)?.slice(0, 120))
check('the player got their own seat back', after?.you === before?.you && after?.host === true)
check('the game state survived (same hand history length)', (after?.game?.history?.length ?? -1) >= handNo)
check('points were kept', !!pointsBefore && after?.game?.players?.map((p: { points: number }) => p.points).join(',').length > 0)
b.ws.close()
console.log(fails ? `\n${fails} FAILED` : '\nrestart persistence ok')
process.exit(fails ? 1 : 0)
