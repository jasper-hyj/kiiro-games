import { makeTable } from '../lib/table'
// Run: npx tsx scripts/cards/relaunch-test.ts   (wrangler :8787) Leave a game table without a goodbye (a closed tab or a fast "Back to room"), then start a DIFFERENT game in the same room straight away:
// the old table's seat only waits out the reconnect grace and must not block the new game.
const WS = process.env.WS ?? 'ws://localhost:8787'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const open = async (url: string) => {
  const ws = new WebSocket(url)
  const got: any[] = []
  ws.addEventListener('message', (e) => {
    try {
      got.push(JSON.parse(String(e.data)))
    } catch {
      /* ignore */
    }
  })
  await new Promise<void>((r) => ws.addEventListener('open', () => r()))
  return { ws, got }
}
for (const [first, firstCfg, partyFirst, second] of [
  ['holdem', { sb: 25, bb: 50, casual: true }, 'main', 'bigtwo'],
  ['bigtwo', {}, 'main', 'gomoku'],
  ['gomoku', { size: 15 }, 'play', 'blackjack'],
  ['mahjong', { rule: 'taiwan' }, 'main', 'chess'],
] as const) {
  const code = await makeTable(first, firstCfg)
  // sit at the first game's table and vanish
  const t = await open(`${WS}/parties/${partyFirst}/${code}`)
  t.ws.send(JSON.stringify({ t: 'join', id: 'ghost-' + code, name: 'Ghost', game: first }))
  await sleep(500)
  t.ws.close()
  await sleep(200)
  // back in the room, start another game
  const room = await open(`${WS}/parties/room/${code}`)
  room.ws.send(JSON.stringify({ t: 'join', id: 'maker-' + code, name: 'Maker' }))
  await sleep(300)
  room.ws.send(JSON.stringify({ t: 'pick', game: second, cfg: second === 'blackjack' ? { bb: 10, casual: true } : second === 'gomoku' ? { size: 15 } : {} }))
  await sleep(300)
  room.ws.send(JSON.stringify({ t: 'launch' }))
  await sleep(800)
  ok(
    room.got.some((m) => m.t === 'go' && m.game === second),
    `${first} -> ${second}: the new game starts straight away (${JSON.stringify(room.got.filter((m) => m.t === 'error' || m.t === 'go').slice(-1))})`,
  )
  room.ws.close()
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
