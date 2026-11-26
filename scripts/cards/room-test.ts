export {}
// Run: npx tsx scripts/cards/room-test.ts   (needs `wrangler dev` on :8787)
// Rooms: create a room, choose a game and rules, members choose play or watch, the host starts, everyone gets sent to the table.
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const code = () => String(1000 + Math.floor(Math.random() * 9000))
function member(room: string, id: string, name: string, create = false) {
  const ws = new WebSocket(`ws://localhost:8787/parties/room/${room}`)
  const c = {
    view: null as any,
    go: null as any,
    talk: [] as any[],
    log: [] as any[],
    errors: [] as string[],
    send: (m: unknown) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
  }
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data))
    if (m.t === 'room') c.view = m
    if (m.t === 'go') c.go = m
    if (m.t === 'talk') c.talk.push(m.msg)
    if (m.t === 'talklog') c.log = m.msgs
    if (m.t === 'error') c.errors.push(m.message)
  }
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id, name, ...(create ? { create: true } : {}) }))
  return c
}
const tag = Math.random().toString(36).slice(2, 5)
const room = code()
const nf = member(code() + '0', 'x' + tag, 'Nobody')
await sleep(500)
ok(nf.errors.includes('room_not_found'), 'joining a room that does not exist is refused')
const host = member(room, 'h' + tag, 'Host', true)
await sleep(500)
ok(host.view?.host === true && host.view.members.length === 1 && host.view.game === null, 'the creator is the host of an empty room with no game yet')
const dupe = member(room, 'd' + tag, 'Dupe', true)
await sleep(500)
ok(dupe.errors.includes('code_taken'), 'creating a code that is in use is refused')
const a = member(room, 'a' + tag, 'Ann')
const b = member(room, 'b' + tag, 'Ben')
await sleep(600)
ok(host.view.members.length === 3 && a.view.host === false, 'others join the room and see they are not the host')
a.send({ t: 'pick', game: 'holdem', cfg: {} })
await sleep(300)
ok(a.errors.includes('host_only') && host.view.game === null, 'only the host can choose the game')
host.send({ t: 'pick', game: 'holdem', cfg: { sb: 25, bb: 50, casual: false, evil: 'x' } })
await sleep(400)
ok(
  a.view.game === 'holdem' && a.view.cfg.sb === 25 && a.view.cfg.casual === false && !('evil' in a.view.cfg),
  'the choice reaches everyone live and unknown settings are dropped',
)
host.send({ t: 'pick', game: 'holdem', cfg: { sb: 1, bb: 3 } })
await sleep(300)
ok(host.view.cfg.sb === 25 && host.view.cfg.bb === 50, 'blinds that are not on the list fall back to a valid one')
host.send({ t: 'pick', game: 'bigtwo', cfg: { ranked: true } })
await sleep(300)
ok(host.errors.includes('ranked_needs_signin') && !host.view.cfg.ranked, 'ranked needs a signed-in host')
host.send({ t: 'pick', game: 'mahjong', cfg: { rule: 'riichi' } })
await sleep(300)
ok(b.view.game === 'mahjong' && b.view.cfg.rule === 'riichi', 'rules for Mahjong are shared')
b.send({ t: 'mode', watching: true })
await sleep(300)
ok(host.view.members.find((m: any) => m.name === 'Ben')?.watching === true, 'a member can choose to watch')
a.send({ t: 'talk', text: 'ready when you are' })
await sleep(400)
ok(host.talk.length === 1 && b.talk.length === 1, 'chat works in the room for everyone')
b.send({ t: 'launch' })
await sleep(300)
ok(b.go === null, 'only the host can start')
host.send({ t: 'launch' })
await sleep(500)
ok(
  host.go?.role === 'host' && a.go?.role === 'play' && b.go?.role === 'watch' && a.go.game === 'mahjong' && a.go.cfg.rule === 'riichi',
  'starting sends each person to the game as host, player or watcher',
)
const late = member(room, 'l' + tag, 'Late')
await sleep(500)
ok(late.view?.launched === true && late.log.length === 1, 'someone arriving later sees the game is running and the earlier chat')
host.close()
a.close()
b.close()
late.close()
await sleep(6000)
const back = member(room, 'k' + tag, 'Back')
await sleep(500)
ok(back.view?.game === 'mahjong' && back.view.launched === true, 'after everyone left for the game the room can still be found again, with its game')
back.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
