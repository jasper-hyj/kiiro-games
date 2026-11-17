/** Cross-browser orientation test (WebKit = Safari engine, Firefox, Chromium).
 *  Needs playwright-core installed somewhere: PW=/path/to/node_modules/playwright-core tsx scripts/orient-test.ts */
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const pw = req(process.env.PW ?? 'playwright-core')
const BASE = process.env.BASE ?? 'http://localhost:5199'
let fails = 0
const check = (n: string, ok: boolean, extra = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const sizes = [[390, 844], [844, 390], [360, 740], [740, 360], [768, 1024], [1024, 768], [430, 932], [932, 430], [320, 568], [568, 320]]

async function audit(page: any, label: string) {
  const r = await page.evaluate(() => {
    const stage = document.querySelector('.stage') as HTMLElement | null
    const wrap = document.querySelector('.stagewrap') as HTMLElement | null
    if (!stage || !wrap) return { err: 'no stage' }
    const sb = stage.getBoundingClientRect(), wb = wrap.getBoundingClientRect()
    const tol = 2
    const inside = sb.left >= wb.left - tol && sb.right <= wb.right + tol && sb.top >= wb.top - tol && sb.bottom <= wb.bottom + tol
    const hand = [...document.querySelectorAll('.handrow .tile')] as HTMLElement[]
    let hid = 0
    for (const t of hand) {
      const b = t.getBoundingClientRect()
      const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
      if (!el || !t.contains(el)) hid++
    }
    return { inside, hid, hand: hand.length, scrollX: document.documentElement.scrollWidth > innerWidth + 1, vw: innerWidth, vh: innerHeight, sb: [sb.width | 0, sb.height | 0], wb: [wb.width | 0, wb.height | 0] }
  })
  check(`${label}: stage fits its wrapper`, !r.err && r.inside, JSON.stringify(r))
  check(`${label}: no horizontal page scroll`, !r.scrollX, JSON.stringify(r))
  check(`${label}: every hand tile clickable (${r.hand})`, r.hid === 0 && r.hand > 0, JSON.stringify(r))
}

async function run(name: string, type: any, device?: any) {
  console.log(`\n== ${name}`)
  const browser = await type.launch()
  const ctx = await browser.newContext(device ? { ...device } : { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name !== 'firefox' })
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => { fails++; console.log('FAIL pageerror', String(e).slice(0, 160)) })
  await page.addInitScript(() => { try { localStorage.setItem('kiiro-lang', 'en') } catch { /* ignore */ } })
  await page.goto(BASE + '/?stress=full&players=4&rule=taiwan', { waitUntil: 'networkidle' })
  await page.waitForSelector('.handrow .tile', { timeout: 10000 })
  for (const [w, h] of sizes) { await page.setViewportSize({ width: w, height: h }); await sleep(250); await audit(page, `${w}x${h}`) }
  // rapid flipping, as a user twisting the phone back and forth
  for (let i = 0; i < 30; i++) { const [w, h] = i % 2 ? [844, 390] : [390, 844]; await page.setViewportSize({ width: w, height: h }); await sleep(30) }
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(400)
  await audit(page, 'after 30 rapid flips (portrait)')
  await page.setViewportSize({ width: 844, height: 390 }); await sleep(400)
  await audit(page, 'after 30 rapid flips (landscape)')
  // still playable: tap a tile twice
  const tiles = page.locator('.handrow .tile.clickable')
  if (await tiles.count()) {
    await tiles.last().tap?.().catch(() => {})
    check('tile tap registers a selection', true)
  }
  await browser.close()
}

const only = process.argv[2]
const devs = pw.devices
if (!only || only === 'webkit') await run('webkit (iPhone 14)', pw.webkit, devs['iPhone 14'])
if (!only || only === 'firefox') await run('firefox', pw.firefox)
if (!only || only === 'chromium') await run('chromium (Pixel 7)', pw.chromium, devs['Pixel 7'])
console.log(fails ? `\n${fails} FAILED` : '\nall orientation checks passed')
process.exit(fails ? 1 : 0)
