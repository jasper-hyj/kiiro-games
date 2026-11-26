import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/tools/ux-tour.ts <outDir> [port]   (wrangler :8787 + vite :5200) Screens that only show up while using the site, on a phone and in
// Traditional Chinese: dialogs, how-to-play panels, result cards, the room as host, error pages. For looking at the design.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const base = `http://localhost:${port}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const shot = async (name: string, path: string, act?: (p: Page) => Promise<unknown>, lang = 'zh') => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 375, height: 667, hasTouch: true, isMobile: true })
  await p.evaluateOnNewDocument((l: string) => localStorage.setItem('kiiro-lang', l), lang)
  p.on('pageerror', (e: unknown) => console.log(name, 'PAGE ERROR', (e as Error).message))
  await p.goto(base + path, { waitUntil: 'domcontentloaded' })
  await sleep(2200)
  try {
    if (act) await act(p)
  } catch (e) {
    console.log(name, 'could not', (e as Error).message.slice(0, 80))
  }
  await sleep(600)
  await p.screenshot({ path: `${out}/ux-${name}.png` })
  await p.browserContext().close()
}
const tap = (p: Page, sel: string) => p.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel)

await shot('hub-picked', '/', (p) => tap(p, '.kg-obj:nth-child(5)'))
await shot('signin', '/', (p) => tap(p, '.kg-acct'))
await shot('register', '/', async (p) => {
  await tap(p, '.kg-acct')
  await sleep(300)
  await tap(p, '.actabs button:nth-child(2)')
})
await shot('help', '/chess/practice', (p) => tap(p, '.k-helpbtn'))
await shot('resign', '/chess/practice', (p) => p.evaluate(() => (Array.from(document.querySelectorAll('.chfoot button')).pop() as HTMLElement).click()))
await shot('room', '/room/new?game=gomoku')
await shot('room-start', '/room/new?game=mahjong', async (p) => {
  await p.evaluate(() => document.querySelector('.rmstart')?.scrollIntoView({ block: 'center' }))
})
await shot('bad-room', '/room/1111')
await shot('bad-table', '/chess/1112')
await shot('unknown', '/nothing-here')
await shot('result-reversi', '/reversi/practice', async (p) => {
  for (let i = 0; i < 90 && !(await p.$('.k-result')); i++) {
    await tap(p, '.rvsq.ok')
    await sleep(900)
  }
  await p.evaluate(() => document.querySelector('.k-result')?.scrollIntoView({ block: 'end' }))
})
await shot('holdem', '/holdem/practice')
await shot('blackjack', '/blackjack/practice')
await shot('bigtwo', '/bigtwo/practice')
await shot('mahjong', '/mahjong/practice')
await shot('tutorial', '/mahjong/tutorial')
await shot('admin', '/admin')
await b.close()
