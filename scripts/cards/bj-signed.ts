import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/bj-signed.ts [outDir]   (local wrangler :8787 + vite :5200) A signed-in player opens Blackjack from a room: does it connect?
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const u = 'bj' + Math.floor(Math.random() * 1e6)
const r = await fetch('http://localhost:8787/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: u, password: 'password123' }),
})
const { token } = (await r.json()) as { token: string }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
p.on('pageerror', (e) => console.log('ERR', (e as Error).message))
p.on('console', (m) => {
  if (m.type() === 'error') console.log('console:', m.text().slice(0, 150))
})
await p.evaluateOnNewDocument((t: string) => {
  localStorage.setItem('kiiro-lang', 'en')
  localStorage.setItem('kiiro-token', t)
}, token)
await p.goto('http://localhost:5200/room/new?game=blackjack', { waitUntil: 'networkidle0' })
await p.waitForSelector('.rmstart button', { timeout: 15000 })
await sleep(800)
await p.click('.rmstart button')
await sleep(5000)
console.log(p.url())
console.log((await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 200))
console.log('table:', !!(await p.$('.bjtable')), 'connecting pill:', await p.$$eval('.k-pill.warn', (e) => e.map((x) => x.textContent)))
await p.screenshot({ path: `${out}/bj-signed.png` })
await b.close()
