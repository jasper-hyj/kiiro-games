import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/blackjack/ui-shots.ts <outDir>   (needs wrangler dev on :8787 and vite on :5200)
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0
for (const [w, h, tag] of [[1280, 760, 'desk'], [390, 780, 'phone'], [844, 390, 'land'], [820, 1180, 'tab']] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: tag !== 'desk', isMobile: tag !== 'desk' })
  await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en') })
  p.on('pageerror', (e: unknown) => { bad++; console.log(tag, 'pageerror', (e as Error).message) })
  await p.goto('http://localhost:5200/blackjack', { waitUntil: 'networkidle0' })
  await p.click('.hdform .hdbtn.primary'); await p.waitForSelector('.bjtable')
  await p.click('.hdsit .hdbtn.primary'); await p.waitForSelector('.bjchips'); await sleep(400)
  await p.screenshot({ path: `${out}/bj-bet-${tag}.png` })
  const chip = await p.$('.bjchip'); if (chip) { await chip.click(); await chip.click() }
  await p.click('.bjbetbar .hdbtn.primary'); await sleep(1200)
  await p.screenshot({ path: `${out}/bj-play-${tag}.png` })
  for (let i = 0; i < 6; i++) { const stand = await p.$('.hdactions .hdbtn'); if (stand) { await stand.click(); await sleep(500) } }
  await sleep(2500)
  await p.screenshot({ path: `${out}/bj-result-${tag}.png` })
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) { bad++; console.log('overflow', tag) }
  await p.browserContext().close()
}
await b.close()
console.log(bad ? 'problems: ' + bad : 'blackjack ui ok')
