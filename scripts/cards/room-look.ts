import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/room-look.ts <outDir>   The room landing and an open room, desktop and phone.
const out = process.argv[2] || '.'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, tag] of [
  [1280, 860, 'desk'],
  [390, 844, 'phone'],
] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto('http://localhost:5200/room', { waitUntil: 'networkidle0' })
  await p.waitForSelector('.kg-solo')
  await p.screenshot({ path: `${out}/room-land-${tag}.png` })
  await p.goto('http://localhost:5200/room/new?game=holdem', { waitUntil: 'networkidle0' })
  await p.waitForSelector('.rmpeople')
  await new Promise((r) => setTimeout(r, 900))
  await p.screenshot({ path: `${out}/room-${tag}.png` })
}
await b.close()
