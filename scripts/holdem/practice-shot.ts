import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/holdem/practice-shot.ts <outDir>   (needs vite on :5200) Hold'em practice against bots, phone and desktop.
setTimeout(() => process.exit(1), 60000)
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, t] of [
  [390, 844, 'phone'],
  [1280, 780, 'desk'],
] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: t === 'phone', isMobile: t === 'phone' })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto('http://localhost:5200/holdem/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.hd-actions', { timeout: 20000 })
  await p.click('.hd-actions .hdbtn.primary')
  await sleep(5500)
  await p.screenshot({ path: `${out}/hd-practice-${t}.png` })
  await p.browserContext().close()
}
await b.close()
process.exit(0)
