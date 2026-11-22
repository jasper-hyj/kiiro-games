import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/holdem/ui-shots.ts <outDir>   (needs wrangler dev on :8787 and vite on :5200)
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0
for (const [w, h, tag] of [[1280, 760, 'desk'], [390, 780, 'phone'], [844, 390, 'land'], [820, 1180, 'tab']] as const) {
  const mk = async () => { const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h, hasTouch: tag !== 'desk', isMobile: tag !== 'desk' }); await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en') }); p.on('pageerror', (e: unknown) => { bad++; console.log(tag, 'pageerror', (e as Error).message) }); return p }
  const A = await mk(), B = await mk()
  await A.goto('http://localhost:5200/holdem', { waitUntil: 'networkidle0' })
  if (tag === 'phone') await A.screenshot({ path: `${out}/hd-menu-${tag}.png` })
  await A.type('.hdform input', 'Ann')
  await A.click('.hdform .hdbtn.primary'); await A.waitForSelector('.hdfelt')
  const room = new URL(A.url()).searchParams.get('room')
  await B.goto(`http://localhost:5200/holdem?room=${room}`, { waitUntil: 'networkidle0' }); await B.waitForSelector('.hdfelt')
  await A.click('.hdsit .hdbtn.primary'); await sleep(300); await B.click('.hdsit .hdbtn.primary'); await sleep(1200)
  await A.screenshot({ path: `${out}/hd-${tag}-a.png` })
  const turnPage = (await A.$('.hdactions .hdbtn')) ? A : B
  await turnPage.screenshot({ path: `${out}/hd-${tag}-turn.png` })
  const ov = await A.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  if (ov) { bad++; console.log('horizontal overflow on', tag) }
  // seats must not overlap each other
  const rects = await A.$$eval('.hdseat:not(.empty)', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }))
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const [a, c] = [rects[i], rects[j]]; if (a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3]) { bad++; console.log('seats overlap on', tag) } }
  // play a few actions so the board and showdown render
  for (let k = 0; k < 6; k++) { for (const p of [A, B]) { const btn = await p.$('.hdactions .hdbtn.primary'); if (btn) { await btn.click(); await sleep(250) } } }
  await sleep(500)
  await A.screenshot({ path: `${out}/hd-${tag}-board.png` })
  await A.browserContext().close(); await B.browserContext().close()
}
await b.close()
console.log(bad ? 'problems: ' + bad : 'ui ok')
