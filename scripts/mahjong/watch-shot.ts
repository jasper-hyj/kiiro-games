import puppeteer from 'puppeteer-core'
setTimeout(() => { console.log('timeout'); process.exit(1) }, 60000)
// Run: npx tsx scripts/mahjong/watch-shot.ts <outDir>   (needs wrangler on :8787 and vite on :5200)
// A browser watches a Mahjong game a socket player started: screenshot of the observer's view.
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const room = String(9000 + Math.floor(Math.random() * 999))
const ws = new WebSocket(`ws://localhost:8787/parties/main/${room}`)
ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id: 'host' + room, name: 'Host', create: true }))
await sleep(600); ws.send(JSON.stringify({ t: 'start' })); await sleep(1000)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, tag] of [[1280, 760, 'desk'], [390, 800, 'phone']] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: tag === 'phone', isMobile: tag === 'phone' })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => console.log(tag, 'pageerror', (e as Error).message))
  await p.goto(`http://localhost:5200/mahjong?room=${room}&watch=1`, { waitUntil: 'domcontentloaded' }); await sleep(1500)
  await p.click('.joincard button[type=submit]'); await sleep(2000)
  console.log(tag, new URL(p.url()).pathname)
  await p.screenshot({ path: `${out}/mjwatch-${tag}.png` })
  await p.browserContext().close()
}
await b.close(); ws.close()
