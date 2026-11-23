import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/mahjong/over-shot.ts <outDir>   (needs vite on :5200) The Mahjong end-of-game dialog from a made-up state.
setTimeout(() => process.exit(1), 60000)
const out = process.argv[2] || '.'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, t] of [[1280, 760, 'desk'], [390, 844, 'phone']] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: t === 'phone', isMobile: t === 'phone' })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto('http://localhost:5200/mahjong?stress=over&players=4', { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 1200))
  await p.screenshot({ path: `${out}/mj-over-${t}.png` }); await p.browserContext().close()
}
await b.close(); process.exit(0)
