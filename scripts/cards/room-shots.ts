import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/room-shots.ts <outDir>   (needs wrangler on :8787 and vite on :5200)
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 90000)
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, tag] of [[1280, 800, 'desk'], [390, 844, 'phone']] as const) {
  const mk = async () => { const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h, hasTouch: tag === 'phone', isMobile: tag === 'phone' }); await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en')); return p }
  const [A, B] = [await mk(), await mk()]
  await A.goto('http://localhost:5200/room?create=1&pick=mahjong&rule=riichi', { waitUntil: 'networkidle0' }); await A.waitForSelector('.rmpeople')
  const room = new URL(A.url()).searchParams.get('room')
  await B.goto(`http://localhost:5200/room?room=${room}`, { waitUntil: 'networkidle0' }); await B.waitForSelector('.rmpeople'); await sleep(800)
  await B.focus('.kgin input'); await B.type('.kgin input', 'who is hosting tonight?'); await B.keyboard.press('Enter'); await sleep(900)
  await A.screenshot({ path: `${out}/room-host-${tag}.png` }); await B.screenshot({ path: `${out}/room-guest-${tag}.png` })
  await A.goto('http://localhost:5200/', { waitUntil: 'networkidle0' }); await A.screenshot({ path: `${out}/hub2-${tag}.png` })
  await A.browserContext().close(); await B.browserContext().close()
}
await b.close(); process.exit(0)
