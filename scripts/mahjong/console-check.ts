import puppeteer from 'puppeteer-core'

/** Plays a solo game for a while in several viewports and reports page errors / console errors (a crash blanks the screen). */
const BASE = process.env.BASE ?? 'http://localhost:5200'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let errors = 0
for (const [w, h] of [
  [1280, 720],
  [844, 390],
  [1024, 768],
] as const) {
  for (const rule of (process.env.RULES ?? 'taiwan,riichi').split(',')) {
    const p = await b.newPage()
    await p.setViewport({ width: w, height: h })
    p.on('pageerror', (e) => {
      errors++
      console.log('PAGE ERROR', w, h, rule, String(e).slice(0, 300))
    })
    p.on('console', (m) => {
      if (m.type() === 'error') {
        errors++
        console.log('CONSOLE ERROR', w, h, rule, m.text().slice(0, 300))
      }
    })
    await p.evaluateOnNewDocument(() => {
      localStorage.setItem('kiiro-lang', 'en')
    })
    await p.goto(`${BASE}/?solo=1&rule=${rule}&speed=0.02`, { waitUntil: 'networkidle0' })
    for (let i = 0; i < 160; i++) {
      if (await p.$('.cbtn.ron')) await p.evaluate(() => (document.querySelector('.cbtn.ron') as HTMLElement).click())
      else if (await p.$('.cbtn.pass')) await p.evaluate(() => (document.querySelector('.cbtn.pass') as HTMLElement).click())
      else {
        const t = await p.$$('.handrow .tile.clickable')
        if (t.length) {
          await t[t.length - 1].click().catch(() => {})
          await sleep(30)
          await p.evaluate(() => (document.querySelector('.handrow .tile.sel') as HTMLElement | null)?.click())
        }
      }
      if (!(await p.$('.gamecol'))) {
        errors++
        console.log('GAME SCREEN GONE', w, h, rule)
        break
      }
      await sleep(40)
    }
    await p.close()
  }
}
await b.close()
console.log(errors ? `${errors} errors` : 'no page errors')
process.exit(errors ? 1 : 0)
