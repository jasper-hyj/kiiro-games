import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/hub-shot.ts <outDir>   The hub at a desktop and a phone size, with a game picked on the table.
const out = process.argv[2] || '.'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, tag] of [[1280, 860, 'desk'], [390, 844, 'phone']] as const) {
  const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto('http://localhost:5200/', { waitUntil: 'networkidle0' }); await p.waitForSelector('.kg-table')
  await p.screenshot({ path: `${out}/hub-${tag}.png` })
  await p.click('.kg-obj:nth-child(1)'); await new Promise((r) => setTimeout(r, 350))
  await p.screenshot({ path: `${out}/hub-${tag}-pick.png` })
}
await b.close()
