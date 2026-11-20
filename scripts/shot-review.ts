import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

/** Visual review sweep: screenshots of every screen at desktop + landscape phone in EN / 繁中 / 日本語. OUT=/tmp/shots/review tsx scripts/shot-review.ts */
const OUT = process.env.OUT ?? '/tmp/shots/review'
mkdirSync(OUT, { recursive: true })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const devs: [string, number, number, boolean][] = [['desk', 1440, 900, false], ['phone', 852, 393, true]]
const langs = (process.env.LANGS ?? 'en').split(',')
for (const lang of langs) for (const [dn, w, h, touch] of devs) {
  const p = await b.newPage()
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1.5, hasTouch: touch, isMobile: touch })
  await p.evaluateOnNewDocument((l) => { (window as any).__name = (f: unknown) => f; try { localStorage.setItem('kiiro-lang', l) } catch { /* ignore */ } }, lang)
  const shot = async (n: string) => { await sleep(500); await p.screenshot({ path: `${OUT}/${lang}-${dn}-${n}.png` }) }
  const click = (sel: string, re?: RegExp) => p.evaluate((sel, src) => { const els = [...document.querySelectorAll<HTMLElement>(sel)]; const el = src ? els.find((e) => new RegExp(src, 'i').test(e.innerText)) : els[0]; el?.click() }, sel, re?.source)
  await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' }); await shot('01-start')
  await click('.btn.gold.big'); await shot('02-rules')
  await click('button.rule'); await shot('03-options')
  await click('.btn.big'); await shot('04-name')
  await p.goto('http://localhost:5199/?stress=call&players=4&rule=riichi', { waitUntil: 'networkidle0' }); await shot('05-table-call')
  await click('.dock summary'); await shot('06-dock')
  await click('.dockpanel .rulesbtn'); await shot('07-rules-help')
  await p.goto('http://localhost:5199/?stress=swap&players=4&rule=sichuan', { waitUntil: 'networkidle0' }); await shot('08-swap')
  await p.goto('http://localhost:5199/?solo=1&rule=taiwan&speed=0.02', { waitUntil: 'networkidle0' })
  for (let i = 0; i < 400 && !(await p.$('.overlay .modal')); i++) {
    if (await p.$('.cbtn.ron')) await click('.cbtn.ron'); else if (await p.$('.cbtn.pass')) await click('.cbtn.pass')
    else { const t = await p.$$('.handrow .tile.clickable'); if (t.length) { await t[t.length - 1].click(); await sleep(40); await p.evaluate(() => (document.querySelector('.handrow .tile.sel') as HTMLElement | null)?.click()) } }
    await sleep(60)
  }
  await shot('09-result')
  await p.close()
}
await b.close()
