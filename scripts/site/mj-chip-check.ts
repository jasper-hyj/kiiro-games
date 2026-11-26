import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/site/mj-chip-check.ts   (needs vite on :5200 and wrangler on :8787)
// The account chip in the Mahjong menu must not overlap the back button or the right-hand toolbar.
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0
const hit = (a: DOMRect, c: DOMRect) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [568, 320],
  [844, 390],
  [820, 1180],
  [1280, 720],
] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: w < 1000, isMobile: w < 1000 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto('http://localhost:5200/mahjong', { waitUntil: 'networkidle0' })
  const r = (await p.evaluate(`(() => {
    const out = {}
    for (const [k, sel] of [['chip', '.accorner .kg-acct'], ['back', '.backbtn'], ['bar', '.floatbar']]) {
      const e = document.querySelector(sel)?.getBoundingClientRect()
      out[k] = e ? { left: e.left, right: e.right, top: e.top, bottom: e.bottom } : null
    }
    return out
  })()`)) as Record<string, DOMRect | null>
  if (!r.chip) {
    console.log(`${w}x${h}: no chip shown`)
    continue
  }
  const c = r.chip as DOMRect
  for (const k of ['back', 'bar'] as const)
    if (r[k] && hit(c, r[k] as DOMRect)) {
      bad++
      console.log(`OVERLAP ${w}x${h}: chip vs ${k}`)
    }
  await p.browserContext().close()
}
await b.close()
console.log(bad ? `${bad} overlaps` : 'no overlaps')
process.exit(bad ? 1 : 0)
