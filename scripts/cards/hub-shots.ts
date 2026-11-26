import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/hub-shots.ts <outDir>   (needs vite on :5200)
const out = process.argv[2] || '.'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, t] of [
  [1280, 800, 'desk'],
  [390, 844, 'phone'],
  [820, 1180, 'tab'],
] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto('http://localhost:5200/', { waitUntil: 'networkidle0' })
  await p.screenshot({ path: `${out}/hub-${t}.png` })
}
await b.close()
