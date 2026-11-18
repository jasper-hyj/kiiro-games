/** Plays full solo games in WebKit (Safari engine) / Chromium with real touch taps while flipping the phone between
 *  portrait and landscape every few turns. PW=/path/to/playwright-core tsx scripts/webkit-game-test.ts [webkit|chromium] [rule,...] */
import { createRequire } from 'node:module'
const pw = createRequire(import.meta.url)(process.env.PW ?? 'playwright-core')
const BASE = process.env.BASE ?? 'http://localhost:5199'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (n: string, ok: boolean, extra = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra) }

async function play(engine: string, rule: string) {
  const type = engine === 'chromium' ? pw.chromium : pw.webkit
  const browser = await type.launch()
  const ctx = await browser.newContext({ ...(engine === 'chromium' ? pw.devices['Pixel 7'] : pw.devices['iPhone 14']) })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e: Error) => errors.push(String(e).slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.setItem('kiiro-lang', 'en'); localStorage.setItem('kiiro-auto2', JSON.stringify({ win: true, discard: false, skip: true, sort: true, coach: false })) } catch { /* ignore */ } })
  await page.goto(`${BASE}/?solo=1&rule=${rule}&speed=0.02`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.handrow .tile', { timeout: 15000 })
  const t0 = Date.now()
  let hands = 0, turns = 0, over = false, flips = 0, bad = 0
  const portrait = { width: 740, height: 360 }, land = { width: 844, height: 390 } // phones play in landscape; flip between two landscape sizes
  while (Date.now() - t0 < 240000) {
    if (await page.$('.overlay .podium')) { over = true; break }
    const next = await page.$('.overlay .btn.gold:not([disabled])')
    if (next) { hands++; await next.tap(); await sleep(150); continue }
    if (await page.$('.pickhint')) {   // Sichuan: pass three tiles / give up a suit
      const btns = await page.$$('.actionpop .cbtn')
      if (btns.length === 3) { await btns[0].tap(); await sleep(200); continue }
      const confirm = await page.$('.actionpop .cbtn.call:not([disabled])')
      if (btns.length === 1 && confirm) { await confirm.tap(); await sleep(200); continue }
      const hand = await page.$$('.handrow .tile.clickable')
      for (let i = 0; i < hand.length && !(await page.$('.actionpop .cbtn.call:not([disabled])')); i++) { await hand[i].tap(); await sleep(40) }
      continue
    }
    const ron = await page.$('.cbtn.ron'); if (ron) { await ron.tap(); await sleep(80); continue }
    const pass = await page.$('.cbtn.pass'); if (pass) { await pass.tap(); await sleep(60); continue }
    const tiles = await page.$$('.handrow .tile.clickable')
    if (tiles.length) {
      try {
        await tiles[tiles.length - 1].tap({ timeout: 2000 })
        await sleep(60)
        const sel = await page.$('.handrow .tile.sel')
        if (sel) await sel.tap({ timeout: 2000 })
      } catch { /* layout changed under the tap: retry next loop */ }
      turns++
      if (turns % 7 === 0) { flips++; await page.setViewportSize(flips % 2 ? land : portrait); await sleep(120) }
      if (turns % 25 === 0) {
        const r = await page.evaluate(() => {
          const s = document.querySelector('.stage')!.getBoundingClientRect(), w = document.querySelector('.stagewrap')!.getBoundingClientRect()
          return s.left >= w.left - 2 && s.right <= w.right + 2 && s.top >= w.top - 2 && s.bottom <= w.bottom + 2
        })
        if (!r) bad++
      }
    }
    await sleep(60)
  }
  check(`${engine}/${rule}: ${hands} hands, ${turns} discards, ${flips} orientation flips -> game over`, over)
  check(`${engine}/${rule}: stage always inside its box while flipping`, bad === 0, `${bad} bad samples`)
  check(`${engine}/${rule}: no page errors`, errors.length === 0, errors.join(' | '))
  await browser.close()
}

const engine = process.argv[2] ?? 'webkit'
for (const rule of (process.argv[3] ?? 'taiwan,hk,riichi').split(',')) await play(engine, rule)
console.log(fails ? `\n${fails} FAILED` : '\nall webkit game checks passed')
process.exit(fails ? 1 : 0)
