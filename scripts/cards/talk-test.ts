export {}
// Run: npx tsx scripts/cards/talk-test.ts   (needs `wrangler dev` on :8787)
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const code = () => String(1000 + Math.floor(Math.random() * 9000))
function client(room: string, id: string, name: string, game: string, create = false) {
  const ws = new WebSocket(`ws://localhost:8787/parties/main/${room}`)
  const talk: any[] = []; const errors: string[] = []; let log: any[] = []
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'talk') talk.push(m.msg); if (m.t === 'talklog') log = m.msgs; if (m.t === 'error') errors.push(m.message) }
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id, name, game, create, pcfg: { bb: 10, casual: true } }))
  return { say: (text: string) => ws.send(JSON.stringify({ t: 'talk', text })), talk, errors, get log() { return log }, close: () => ws.close() }
}
const tag = Math.random().toString(36).slice(2, 5)
for (const game of ['blackjack', 'holdem', 'bigtwo']) {
  const room = code()
  const a = client(room, 'a' + tag, 'Ann', game, true); await sleep(500)
  const b = client(room, 'b' + tag, 'Ben', game); await sleep(500)
  a.say('hello <b>table</b>'); await sleep(400)
  ok(a.talk.length === 1 && b.talk.length === 1, `${game}: a message reaches everyone in the room`)
  ok(b.talk[0]?.name === 'Ann' && !/[<>]/.test(b.talk[0]?.text ?? ''), `${game}: it carries the sender's name and tags are stripped (${b.talk[0]?.text})`)
  a.say('again too fast'); await sleep(300)
  ok(a.errors.includes('slow_down') && b.talk.length === 1, `${game}: messages sent within a second are refused`)
  await sleep(900)
  a.say('x'.repeat(500)); await sleep(400)
  ok(b.talk[1]?.text.length === 140, `${game}: long messages are cut to 140 characters`)
  const c = client(room, 'c' + tag, 'Cy', game); await sleep(600)
  ok(c.log.length === 2, `${game}: someone joining later receives the recent chat (${c.log.length})`)
  a.close(); b.close(); c.close(); await sleep(200)
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
