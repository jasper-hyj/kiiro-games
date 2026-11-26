import { makeTable } from '../lib/table'
// Run: npx tsx scripts/generic/play-test.ts   (wrangler dev on :8787) The Play server end to end over real sockets: a room prepares a table, two people sit, play, watch and chat.
const WS = process.env.WS ?? 'ws://localhost:8787'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const client = async (code: string, id: string, name: string, game: string, extra: Record<string, unknown> = {}) => {
  const ws = new WebSocket(`${WS}/parties/play/${code}`)
  const got: any[] = []
  ws.addEventListener('message', (e) => {
    try {
      got.push(JSON.parse(String(e.data)))
    } catch {
      /* ignore */
    }
  })
  await new Promise<void>((res) => ws.addEventListener('open', () => res()))
  ws.send(JSON.stringify({ t: 'join', id, name, game, ...extra }))
  await sleep(500)
  return {
    ws,
    got,
    view: () => got.filter((m) => m.t === 'pview').at(-1)?.view,
    send: (m: unknown) => ws.send(JSON.stringify({ t: 'p', m })),
    say: (text: string) => ws.send(JSON.stringify({ t: 'talk', text })),
    errors: () => got.filter((m) => m.t === 'error').map((m) => m.message),
  }
}
for (const [game, cfg] of [['gomoku', { size: 15 }]] as const) {
  const code = await makeTable(game, cfg, undefined, 2)
  const a = await client(code, 'pa' + code, 'Ann', game)
  ok(a.view()?.kind === game && a.view().you >= 0, `${game}: the first person to open the table sits at it`)
  ok(a.view()?.host === true, `${game}: and is its host (the room's host)`)
  ok(a.view()?.config.size === 15, `${game}: the room's settings are on the table`)
  const b = await client(code, 'pb' + code, 'Bob', game)
  ok(b.view()?.you >= 0 && b.view().host === false, `${game}: a second person sits down as a guest`)
  const w = await client(code, 'pw' + code, 'Wat', game, { watch: true })
  ok(w.view()?.you === -1 && w.view().watching === 1, `${game}: a spectator joins without a seat`)
  await sleep(500)
  ok(a.view().status === 'playing', `${game}: a table made from a room starts by itself once every seat is taken by the room's players`)
  const first = a.view().turn === a.view().you ? a : b
  const second = first === a ? b : a
  first.send({ k: 'act', a: { x: 7, y: 7 } })
  await sleep(300)
  ok(second.view().state.board[7 * 15 + 7] !== 0, `${game}: a move reaches the opponent`)
  ok(w.view().state.board[7 * 15 + 7] !== 0, `${game}: and the spectator`)
  second.send({ k: 'act', a: { x: 7, y: 7 } })
  await sleep(300)
  ok(second.errors().includes('bad_move'), `${game}: an illegal move is refused with a reason`)
  first.send({ k: 'act', a: { x: 1, y: 1 } })
  await sleep(300)
  ok(first.errors().includes('not_your_turn'), `${game}: moving out of turn is refused`)
  w.say('nice opening')
  await sleep(300)
  ok(
    a.got.some((m) => m.t === 'talk' && m.msg.text === 'nice opening'),
    `${game}: a spectator's chat reaches the players`,
  )
  w.send({ k: 'act', a: { x: 3, y: 3 } })
  await sleep(300)
  ok(w.errors().includes('not_playing'), `${game}: a spectator cannot move`)
  // persistence: the same table after everyone reconnects
  b.ws.close()
  await sleep(400)
  const b2 = await client(code, 'pb' + code, 'Bob', game)
  ok(b2.view()?.you >= 0 && b2.view().state.board[7 * 15 + 7] !== 0, `${game}: a player who reconnects gets their seat and the game back`)
  for (const c of [a, b2, w]) c.ws.close()
}
// a table that was never prepared does not exist
{
  const ws = new WebSocket(`${WS}/parties/play/9998`)
  const got: any[] = []
  ws.addEventListener('message', (e) => got.push(JSON.parse(String(e.data))))
  await new Promise<void>((r) => ws.addEventListener('open', () => r()))
  ws.send(JSON.stringify({ t: 'join', id: 'x', name: 'X', game: 'gomoku' }))
  await sleep(500)
  ok(
    got.some((m) => m.t === 'error' && m.message === 'room_not_found'),
    'a table nobody prepared is "not found"',
  )
  ws.close()
}
// the internal route is closed to the outside
{
  const r = await fetch(`${WS.replace('ws', 'http')}/parties/play/9997/__prepare`, { method: 'POST', body: '{}' })
  ok(r.status === 404, 'the prepare route is closed from outside')
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
