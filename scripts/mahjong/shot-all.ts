import { createRequire } from 'node:module'
/** screenshots of every screen on desktop / tablet / phone in both languages: PW=... tsx scripts/shot-all.ts */
const pw = createRequire(import.meta.url)(process.env.PW ?? 'playwright-core')
const out = process.env.OUT ?? '/tmp/shots/all'
const { mkdirSync } = await import('node:fs')
mkdirSync(out, { recursive: true })
const b = await pw.chromium.launch()
const devs: [string, number, number, boolean][] = [
  ['desk', 1440, 900, false],
  ['tab', 820, 1180, true],
  ['phone', 390, 844, true],
]
for (const lang of ['en', 'zh'])
  for (const [dn, w, h, touch] of devs) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && w < 600 })
    const p = await c.newPage()
    await p.addInitScript((l: string) => localStorage.setItem('kiiro-lang', l), lang)
    const snap = async (n: string) => {
      await p.waitForTimeout(500)
      await p.screenshot({ path: `${out}/${lang}-${dn}-${n}.png` })
    }
    await p.goto('http://localhost:5199/mahjong', { waitUntil: 'networkidle' })
    await snap('1start')
    await p.click('.btn.gold.big')
    await snap('2rules')
    await p.click('button.rule >> nth=2')
    await snap('3options')
    await p.click('.btn.big')
    await snap('4name')
    await p.goto('http://localhost:5199/?stress=call&players=4&rule=taiwan', { waitUntil: 'networkidle' })
    await snap('5table')
    await p.locator('.dock summary').click()
    await snap('6dock')
    await c.close()
  }
await b.close()
