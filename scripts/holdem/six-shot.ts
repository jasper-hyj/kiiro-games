import puppeteer from 'puppeteer-core'
const MK = (g: string, cfg: object) => `${process.env.BASE ?? 'http://localhost:5200'}/${g}?room=${1000 + Math.floor(Math.random() * 9000)}&make=1&cfg=${encodeURIComponent(JSON.stringify(cfg))}` // tables are made from a room now; this opens one directly
// Run: npx tsx scripts/holdem/six-shot.ts <outDir>   six players at one table, screenshots from seat 0
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0
for (const [w, h, tag] of [[1280, 760, 'desk'], [390, 780, 'phone'], [844, 390, 'land']] as const) {
  const pages = []
  for (let i = 0; i < 6; i++) { const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h, hasTouch: tag !== 'desk', isMobile: tag !== 'desk' }); await p.evaluateOnNewDocument((n) => { localStorage.setItem('kiiro-lang', 'en'); localStorage.setItem('kiiro-name', 'Player' + n) }, i); pages.push(p) }
  await pages[0].goto('http://localhost:5200/holdem', { waitUntil: 'networkidle0' })
  await pages[0].goto(MK('holdem', { sb: 25, bb: 50, casual: true })); await pages[0].waitForSelector('.hdfelt')
  const room = new URL(pages[0].url()).searchParams.get('room')
  for (let i = 1; i < 6; i++) { await pages[i].goto(`http://localhost:5200/holdem?room=${room}`, { waitUntil: 'networkidle0' }); await pages[i].waitForSelector('.hdfelt') }
  for (const p of pages) { await p.click('.hdsit .hdbtn.primary'); await sleep(250) }
  await sleep(900)
  // everybody calls once so bets and a flop appear
  for (let k = 0; k < 8; k++) for (const p of pages) { const btn = await p.$('.hdactions .hdbtn.primary'); if (btn) { await btn.click(); await sleep(120) } }
  await sleep(600)
  await pages[0].screenshot({ path: `${out}/hd6-${tag}.png` })
  const rects = await pages[0].$$eval('.hdseat:not(.empty)', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }))
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const [a, c] = [rects[i], rects[j]]; if (a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3]) { bad++; console.log('seats overlap on', tag, i, j) } }
  if (await pages[0].evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) { bad++; console.log('overflow', tag) }
  for (const p of pages) await p.browserContext().close()
}
await b.close()
console.log(bad ? 'problems: ' + bad : 'six ok')
