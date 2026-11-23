export {}
// Run: npx tsx scripts/cards/code-test.ts   (needs wrangler dev on :8787)
// A room code that a game table already uses must be reported as taken, so a new room never lands on someone else's table.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const code = String(7000 + Math.floor(Math.random() * 900))
const free = async (c: string) => ((await (await fetch(`http://localhost:8787/api/code/${c}`)).json()) as { free: boolean }).free
ok((await free(code)) === true, 'an unused code is free')
const ws = new WebSocket(`ws://localhost:8787/parties/main/${code}`)
ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id: 'c' + code, name: 'Squat', game: 'bigtwo', create: true, pcfg: { bb: 0, casual: true } }))
await sleep(900)
ok((await free(code)) === false, 'a code with a Big Two table on it is taken')
ok((await free('abc')) === false, 'a malformed code is refused')
ws.close(); await sleep(300)
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
