import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/collision-test.ts   (needs wrangler dev on :8787 and vite on :5200)
// A new table whose random room code is already used by a room of ANOTHER game must retry with a new code, not jump into that room.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const BASE = process.env.BASE ?? 'http://localhost:5200'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }

// an existing hold'em room on code 5500 (Math.random() = 0.5 -> 1000 + floor(0.5 * 9000) = 5500)
const ws = new WebSocket('ws://localhost:8787/parties/main/5500')
ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id: 'squatter', name: 'Squat', game: 'holdem', create: true, pcfg: { sb: 25, bb: 50, casual: true } }))
await sleep(800)

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [path, app, ready] of [['/blackjack', 'BlackjackApp', '.bjtable'], ['/holdem', 'HoldemApp', '.hdfelt'], ['/bigtwo', 'BigTwoApp', '.btlobby']] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.evaluateOnNewDocument((appName: string) => {
    localStorage.setItem('kiiro-lang', 'en')
    const real = Math.random.bind(Math); let used = 0
    // the first code this app generates is the occupied one
    Math.random = () => { if (used < 1 && new Error().stack?.includes(appName)) { used++; return 0.5 } return real() }
  }, app)
  await p.goto(BASE + path, { waitUntil: 'networkidle0' })
  await p.click('.hdform .hdbtn.primary'); await p.waitForSelector(ready, { timeout: 15000 }).catch(() => {})
  await sleep(500)
  const url = new URL(p.url())
  const inTable = !!(await p.$(ready))
  if (path === '/holdem') {
    // the squatter is a hold'em room too: creating on its code must say "code taken" and retry
    ok(inTable && url.pathname === '/holdem' && url.searchParams.get('room') !== '5500', `${path}: retried after the code was taken (room ${url.searchParams.get('room')})`)
  } else {
    ok(inTable && url.pathname === path && url.searchParams.get('room') !== '5500', `${path}: retried instead of jumping into the hold'em room (now ${url.pathname}?room=${url.searchParams.get('room')})`)
  }
  await p.browserContext().close()
}
await b.close(); ws.close()
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
