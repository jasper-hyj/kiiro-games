import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/codebox-shot.ts <outDir> [port]   The room code boxes with digits typed in (readable on the felt).
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 390, height: 700, hasTouch: true, isMobile: true })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.k-codebox')
await p.click('.k-codebox')
await p.keyboard.type('48')
await new Promise((r) => setTimeout(r, 300))
await p.screenshot({ path: `${out}/codebox.png`, clip: { x: 0, y: 200, width: 390, height: 260 } })
console.log(await p.$$eval('.k-codebox', (e) => e.map((x) => getComputedStyle(x).color + ' on ' + getComputedStyle(x).backgroundColor).join(' | ')))
await b.close()
