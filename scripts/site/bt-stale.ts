import puppeteer, { type Page } from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/site/bt-stale.ts   (local wrangler :8787 + vite :5200)
// Regression: after my own play, the next turn starts with nothing selected, and one tap on a card that beats the trick is playable without pressing Clear.
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
const p: Page = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1100, height: 800 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
p.on('pageerror', (e: unknown) => {
  fails++
  console.log('PAGEERROR', (e as Error).message)
})
await p.goto(await tableUrl('bigtwo', {}), { waitUntil: 'networkidle0' })
await p.waitForSelector('.hdform .hdbtn.primary')
await p.click('.hdform .hdbtn.primary')
await p.waitForSelector('.bthand .btcard')
const myTurn = async () => {
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    if (await p.$('.bt-play:not([disabled]), .hdactions .hdbtn.primary')) {
      const r = await p.$eval('.bt-reason', (e) => e.textContent || '')
      if (r) return true
    }
    await sleep(250)
  }
  return false
}
let plays = 0
for (let round = 0; round < 8 && plays < 3; round++) {
  if (!(await myTurn())) break
  const lifted0 = await p.$$eval('.btcard.sel', (e) => e.length)
  ok(lifted0 === 0, `turn ${round + 1}: nothing is selected when my turn starts (${lifted0})`)
  const reason0 = await p.$eval('.bt-reason', (e) => e.textContent || '')
  ok(!/too low|does not beat|not a play|doesn.t beat/i.test(reason0), `turn ${round + 1}: no leftover complaint ("${reason0.slice(0, 50)}")`)
  // use the hint (a legal play) and play it, or pass when nothing beats the trick
  await p.click('.hdactions .hdbtn:nth-child(2)')
  await sleep(250)
  if (await p.$('.bt-play:not([disabled])')) {
    await p.click('.bt-play')
    plays++
  } else await p.click('.hdactions .hdbtn.primary')
  await sleep(1500)
}
ok(plays >= 2, `played ${plays} times in a row without pressing Clear`)
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
