import puppeteer from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/cards/one.ts <game> <w> <h> <out.png> [step]   (needs wrangler on :8787 and vite on :5200)
// One game's table, opened directly, with a step: lobby | table | sit.
setTimeout(() => process.exit(1), 60000)
const [game, w, h, out, step = 'table'] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const cfg = game === 'holdem' ? { sb: 25, bb: 50, casual: true } : game === 'blackjack' ? { bb: 10, casual: true } : {}
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
p.on('pageerror', (e: unknown) => console.log('PAGEERROR', (e as Error).message))
await p.goto(await tableUrl(game, cfg), { waitUntil: 'domcontentloaded' })
await sleep(1800)
if (step !== 'lobby') {
  if (game === 'bigtwo') {
    await p.click('.hdform .hdbtn.primary')
    await sleep(1800)
  }
  if (game === 'blackjack' || game === 'holdem') {
    await p.click('.hdsit .hdbtn.primary')
    await sleep(900)
  }
  if (game === 'holdem' && step === 'two') {
    const q = await (await b.createBrowserContext()).newPage()
    await q.goto(p.url(), { waitUntil: 'domcontentloaded' })
    await sleep(1500)
    await q.click('.hdsit .hdbtn.primary')
    await sleep(2500)
  }
  if (game === 'blackjack' && step === 'bet') {
    const c = await p.$('.bjchip')
    await c?.click()
    await c?.click()
    await sleep(300)
  }
}
await p.screenshot({ path: out })
await b.close()
process.exit(0)
