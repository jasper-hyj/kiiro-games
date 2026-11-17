import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5199'
const SHOTS = process.env.SHOTS ?? '/tmp/shots'
mkdirSync(SHOTS, { recursive: true })
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
let fails = 0
const check = (n: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function tap(p: Page, touch: boolean, sel: string, nth = 0) {
  const h = (await p.$$(sel))[nth]
  if (!h) return false
  const b = await h.boundingBox()
  if (!b) return false
  if (touch) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  else await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  return true
}

interface Dev { name: string; w: number; h: number; touch: boolean }

const n4 = (n: number) => String(n)

async function playGame(browser: Browser, rule: string, dev: Dev, lang: 'en' | 'zh') {
  const tag = `${rule}/${dev.name}/${lang}`
  const p = await browser.newPage()
  await p.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: dev.touch ? 2 : 1, hasTouch: dev.touch, isMobile: dev.touch })
  await p.evaluateOnNewDocument((l) => {
    try {
      localStorage.setItem('kiiro-lang', l)
      localStorage.setItem('kiiro-auto', JSON.stringify({ win: true, discard: false, skip: false }))
    } catch { /* ignore */ }
  }, lang)
  const errors: string[] = []
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/?solo=1&rule=${rule}&speed=0.02`, { waitUntil: 'networkidle0' })
  await p.waitForSelector('.board .handrow .tile', { timeout: 10000 })
  const t0 = Date.now()
  let hands = 0
  let shotResult = false
  let over = false
  let turns = 0
  while (Date.now() - t0 < 240000) {
    if (await p.$('.overlay .standings')) { over = true; break }
    const nextBtn = await p.$('.overlay .btn.gold:not([disabled])')
    if (nextBtn) {
      hands++
      if (!shotResult) {
        await p.screenshot({ path: `${SHOTS}/game-${rule}-${dev.name}-${lang}-result.png` })
        shotResult = true
      }
      await nextBtn.evaluate((e) => (e as HTMLElement).click())
      await sleep(150)
      continue
    }
    if (await p.$('.pickhint')) {   // Sichuan: pass three tiles / give up a suit
      const confirm = await p.$('.apbtns .cbtn.call:not([disabled])')
      if (confirm && (await p.$$('.apbtns .cbtn')).length === 1) { await tap(p, dev.touch, '.apbtns .cbtn.call'); await sleep(200); continue }
      if ((await p.$$('.apbtns .cbtn')).length === 3) { await tap(p, dev.touch, '.apbtns .cbtn', 0); await sleep(200); continue }
      const hand = await p.$$('.handrow .tile.clickable')
      for (let i = 0; i < hand.length && !(await p.$('.apbtns .cbtn.call:not([disabled])')); i++) { await tap(p, dev.touch, '.handrow .tile.clickable', i); await sleep(40) }
      continue
    }
    if (await p.$('.cbtn.ron')) { await tap(p, dev.touch, '.cbtn.ron'); await sleep(80); continue }
    if (await p.$('.cbtn.pass')) { await tap(p, dev.touch, '.cbtn.pass'); await sleep(60); continue }
    const tiles = await p.$$('.handrow .tile.clickable')
    if (tiles.length) {
      await tap(p, dev.touch, '.handrow .tile.clickable', tiles.length - 1)
      await sleep(60)
      await tap(p, dev.touch, '.handrow .tile.sel')
      turns++
    }
    await sleep(60)
  }
  check(`${tag}: played ${hands} hands (${turns} discards) to the game-over screen`, over, `timed out after ${hands} hands`)
  if (over) {
    await p.screenshot({ path: `${SHOTS}/game-${rule}-${dev.name}-${lang}-over.png` })
    const rows = await p.$$eval('.overlay .standings li', (e) => e.map((x) => (x as HTMLElement).innerText))
    const pts = rows.map((r) => Number((r.match(/—\s*(-?\d+)/) ?? [])[1]))
    const start = rule === 'riichi' ? 25000 : rule === 'mcr' || rule === 'sichuan' ? 0 : 1000
    check(`${tag}: final standings list 4 players and points add up (${pts.join(', ')})`, rows.length === 4 && pts.reduce((a, b) => a + b, 0) === start * 4, rows.join(' | '))
    // hand review: open it, step to the end of the first hand and see the final hands
    await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>('.overlay .btn')].find((e) => /Review hands|回顧牌局/i.test(e.innerText)); b?.click() })
    await sleep(300)
    check(`${tag}: hand review opens with ${n4(await p.$$eval('.rp-row', (e) => e.length))} player rows`, (await p.$$eval('.rp-row', (e) => e.length)) >= 3)
    await p.evaluate(() => { const r = document.querySelector('.rp-ctl input[type=range]') as HTMLInputElement; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; set.call(r, r.max); r.dispatchEvent(new Event('input', { bubbles: true })) })
    await sleep(200)
    check(`${tag}: review's last step shows the final hands`, (await p.$$eval('.rp-final .tile', (e) => e.length)) > 0)
    await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>('.modal .btn')].find((e) => /Close|關閉/.test(e.innerText)); b?.click() })
    await sleep(200)
    await p.evaluate(() => (document.querySelector('.overlay .btn.alt') as HTMLElement | null)?.click())
    await sleep(300)
    check(`${tag}: Leave from the game-over screen returns to the menu`, (await p.$('.menu')) !== null)
  }
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await p.close()
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    const devs: Dev[] = [
      { name: 'desktop', w: 1440, h: 900, touch: false },
      { name: 'phone', w: 390, h: 844, touch: true },
    ]
    const rules = process.env.RULES?.split(',') ?? ['taiwan', 'hk', 'riichi', 'mcr', 'sichuan']
    for (const rule of rules) for (const d of devs) await playGame(browser, rule, d, d.name === 'phone' ? 'zh' : 'en')
  } finally {
    await browser.close()
  }
  console.log(fails ? `\n${fails} FAILED` : '\nall full-game checks passed')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
