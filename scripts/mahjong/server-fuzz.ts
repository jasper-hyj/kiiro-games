/** Hostile-client test against the real online server (run `npm run party:dev` first). */
const HOST = process.env.HOST ?? 'localhost:8787'
let fails = 0
const check = (n: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface C {
  ws: WebSocket
  msgs: any[]
  closed: boolean
}
function connect(room: string): Promise<C> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${HOST}/parties/main/${room}`)
    const c: C = { ws, msgs: [], closed: false }
    ws.onmessage = (e) => {
      try {
        c.msgs.push(JSON.parse(String(e.data)))
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      c.closed = true
    }
    ws.onopen = () => resolve(c)
    ws.onerror = () => reject(new Error('connect failed'))
  })
}
const send = (c: C, m: unknown) => c.ws.send(typeof m === 'string' ? m : JSON.stringify(m))
const lastView = (c: C) => [...c.msgs].reverse().find((m) => m.t === 'view')?.view

async function main() {
  const room = 'fz' + Math.floor(Math.random() * 1e6)

  // 1. garbage never breaks the room
  const a = await connect(room)
  const garbage: unknown[] = [
    'not json',
    '{',
    '[]',
    'null',
    '123',
    '"str"',
    { t: 5 },
    { t: 'join' },
    { t: 'join', id: null, name: 5 },
    { t: 'join', id: 'x'.repeat(5000), name: 'y' },
    { t: 'act', a: null },
    { t: 'act', a: { type: 'discard', tile: 'abc' } },
    { t: 'decide', d: 7 },
    { t: 'config', config: 'hk' },
    { t: 'config', config: { rule: 'pwn', rounds: 9e9, players: 99 } },
    { t: 'toggleBot', seat: 'a' },
    { t: 'chat', key: { a: 1 } },
    { t: '__proto__', x: 1 },
    { t: 'start' },
    { t: 'ack' },
    { t: 'lobby' },
  ]
  for (const g of garbage) send(a, g)
  send(a, 'x'.repeat(2_000_000)) // oversized payload
  await sleep(500)
  check('connection survives garbage', !a.closed)
  send(a, { t: 'join', id: 'good1', name: 'Alice <script>', create: true })
  await sleep(400)
  const v = lastView(a)
  check('valid join still works after garbage', !!v && v.you === 0 && v.host === true)
  check('name was sanitised (no angle brackets)', !!v && !/[<>]/.test(v.seats[0].name), v?.seats[0].name)

  // 2. malicious config cannot corrupt the room
  send(a, { t: 'config', config: { rule: 'riichi', rounds: 99999, players: 3, minFan: -5, botLevel: 'god' } })
  await sleep(300)
  const cfg = lastView(a)?.config
  check(
    'config values are validated',
    cfg && cfg.rule === 'riichi' && [1, 2].includes(cfg.rounds) && cfg.players === 3 && cfg.minFan >= 0 && cfg.botLevel === 'normal',
    JSON.stringify(cfg),
  )

  // 3. room overflow: 10 more clients, only 4 seats
  const extra: C[] = []
  for (let i = 0; i < 10; i++) {
    const c = await connect(room)
    send(c, { t: 'join', id: 'extra' + i, name: 'E' + i })
    extra.push(c)
  }
  await sleep(800)
  const seated = extra.filter((c) => lastView(c)?.you >= 0).length
  const watching = extra.filter((c) => lastView(c)?.you === -1).length
  check(
    `a full table seats nobody more, the rest watch (3p riichi: ${seated} extra seated, ${watching} watching)`,
    seated === 2 && watching === 8,
    `${seated}/${watching}`,
  )

  // 4. flood
  for (let i = 0; i < 3000; i++) send(a, { t: 'chat', key: 'hello' })
  await sleep(600)
  check('server alive after a 3000-message flood', !a.closed)

  // 5. rapid connect / disconnect churn
  for (let i = 0; i < 60; i++) {
    const c = await connect(room)
    send(c, { t: 'join', id: 'churn' + (i % 3), name: 'c' })
    c.ws.close()
  }
  await sleep(500)
  const fresh = await connect(room)
  send(fresh, { t: 'join', id: 'good1', name: 'Alice' })
  await sleep(500)
  check('same player id rejoins their seat after churn', lastView(fresh)?.you === 0)

  // 6. start a game with garbage in flight, then everyone leaves: server stays healthy
  send(fresh, { t: 'start' })
  await sleep(600)
  check('game starts', lastView(fresh)?.status === 'playing')
  const mySeat = lastView(fresh)?.you // seats are shuffled when the game starts
  for (const c of [a, fresh, ...extra]) c.ws.close()
  await sleep(500)
  const again = await connect(room)
  send(again, { t: 'join', id: 'good1', name: 'Alice' })
  await sleep(500)
  check('room still usable after everyone disconnected (rejoin to a running game)', lastView(again)?.status === 'playing' && lastView(again)?.you === mySeat)
  again.ws.close()

  console.log(fails ? `\n${fails} FAILED` : '\nserver survived every hostile input')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
