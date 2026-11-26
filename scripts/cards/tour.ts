import puppeteer from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/cards/tour.ts <outDir> [w h]   (needs wrangler on :8787 and vite on :5200)
// A screenshot of every kind of screen, for reviewing how consistent the games look. One browser, one page at a time.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 150000)
const out = process.argv[2] || '.'
const [w, h] = [Number(process.argv[3] || 390), Number(process.argv[4] || 844)]
const tag = (w < 600 ? 'p' : 'd') + (process.env.LANGX && process.env.LANGX !== 'en' ? '-' + process.env.LANGX : '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const B = 'http://localhost:5200'
const mkc = (g: string, cfg: object) => tableUrl(g, cfg)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const shot = async (name: string, url: string, after?: (p: any) => Promise<void>) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: w < 600, isMobile: w < 600 })
  await p.evaluateOnNewDocument((l: string) => localStorage.setItem('kiiro-lang', l), process.env.LANGX || 'en')
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded' })
    await sleep(1800)
    if (after) await after(p)
    await sleep(600)
    await p.screenshot({ path: `${out}/tour-${tag}-${name}.png` })
  } catch (e) {
    console.log('skip', name, String((e as Error).message).slice(0, 80))
  }
  await p.browserContext().close()
}
await shot('hub', B + '/')
await shot('room', B + '/room/new?game=holdem')
await shot('mj-menu', B + '/mahjong')
await shot('mj-lobby', await mkc('mahjong', { rule: 'taiwan' }))
await shot('mj-board', B + '/mahjong/practice')
await shot('hd-table', await mkc('holdem', { sb: 25, bb: 50, casual: true }))
await shot('hd-menu', B + '/holdem')
await shot('bj-table', await mkc('blackjack', { bb: 10, casual: true }), async (p) => {
  await p.click('.hdsit .hdbtn.primary')
  await sleep(800)
})
await shot('bt-lobby', await mkc('bigtwo', {}))
await shot('bt-table', await mkc('bigtwo', {}), async (p) => {
  await p.waitForSelector('.hdform .hdbtn.primary', { timeout: 8000 })
  await p.click('.hdform .hdbtn.primary')
  await sleep(1800)
})
await b.close()
process.exit(0)
