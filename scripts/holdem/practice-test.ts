import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/holdem/practice-test.ts   (needs vite on :5200; the game server is not needed)
// Hold'em practice against three bots, in the browser: it deals, the bots act, I can play several hands, and leaving goes home.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 240000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
const net: string[] = []
p.on('request', (r) => {
  if (/:8787|workers\.dev/.test(r.url())) net.push(r.url())
})
p.on('pageerror', (e: unknown) => {
  fails++
  console.log('PAGEERROR', (e as Error).message)
})
await p.goto('http://localhost:5200/', { waitUntil: 'networkidle0' })
await p.evaluate(() => (Array.from(document.querySelectorAll('.kg-obj')).find((e) => /Hold/.test(e.textContent || '')) as HTMLElement).click())
await sleep(300)
const link = await p.$eval('a.kg-practice', (a) => a.getAttribute('href') ?? '')
ok(link === '/holdem/practice', "the hub offers Hold'em practice (" + link + ')')
net.length = 0 // the hub itself asks the server for the leaderboard; practice must not
await p.goto('http://localhost:5200' + link, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.hdfelt', { timeout: 15000 })
await sleep(1500)
ok((await p.$$eval('.hdseat:not(.empty)', (e) => e.length)) === 4, 'four seats are filled: me and three bots')
ok(
  /Practice|練習/.test(await p.$eval('.k-head', (e) => e.textContent || '')) && !(await p.$('.kgchat')),
  'the header says Practice and there is no chat or invite link',
)
let hands = 0,
  mine = 0,
  sawBotAct = false
const seen = new Set<string>()
for (let i = 0; i < 500 && hands < 4; i++) {
  const btn = await p.$('.hd-actions .hdbtn.primary')
  if (btn) {
    mine++
    await btn.click().catch(() => {})
    await sleep(250)
  }
  const txt = await p.$eval('.hdfelt', (e) => e.textContent || '')
  if (/(check|call|raise|bet|fold)/i.test(txt)) sawBotAct = true
  const w = txt.match(/Bot \d wins [\d,]+|Player wins [\d,]+|Split pot/)?.[0]
  if (w && !seen.has(w + hands)) {
    seen.add(w + hands)
    hands++
  }
  await sleep(400)
}
ok(sawBotAct, 'the bots take their turns (their actions show at the table)')
ok(mine >= 3, `I got to act ${mine} times`)
ok(hands >= 3, `${hands} hands finished with a winner`)
ok(net.length === 0, 'it ran without any request to the game server')
await p.click('.k-back')
await sleep(1500)
ok(new URL(p.url()).pathname === '/', 'leaving practice goes back to the hub')
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
