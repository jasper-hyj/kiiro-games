import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5199'
const SHOTS = process.env.SHOTS ?? '/tmp/shots'
mkdirSync(SHOTS, { recursive: true })
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let fails = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : extra)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Dev { name: string; w: number; h: number; touch: boolean; scale: number }
const ALL: Dev[] = [
  { name: 'desktop', w: 1440, h: 900, touch: false, scale: 1 },
  { name: 'laptop', w: 1024, h: 700, touch: false, scale: 1 },
  { name: 'tablet', w: 768, h: 1024, touch: true, scale: 2 },
  { name: 'phone', w: 844, h: 390, touch: true, scale: 2 },
  { name: 'phone-small', w: 667, h: 375, touch: true, scale: 2 },
  { name: 'landscape', w: 844, h: 390, touch: true, scale: 2 },
]
const only = process.env.DEVICES?.split(',')
const DEVICES = only ? ALL.filter((d) => only.includes(d.name)) : ALL
const LANGS = (process.env.LANGS?.split(',') ?? ['en', 'zh']) as ('en' | 'zh')[]

async function newPage(b: Browser, d: Dev, lang: 'en' | 'zh' = 'en'): Promise<Page> {
  const p = await b.newPage()
  await p.setViewport({ width: d.w, height: d.h, deviceScaleFactor: d.scale, hasTouch: d.touch, isMobile: d.touch })
  await p.evaluateOnNewDocument((l) => {
    try {
      localStorage.setItem('kiiro-lang', l)
      localStorage.setItem('kiiro-auto', JSON.stringify({ win: true, discard: false, skip: false }))
    } catch { /* ignore */ }
  }, lang)
  p.on('pageerror', (e) => { fails++; console.log('FAIL pageerror', String(e).slice(0, 200)) })
  return p
}
const text = (p: Page) => p.evaluate(() => document.body.innerText)
const clickText = (p: Page, sel: string, re: RegExp) =>
  p.evaluate((sel, src, fl) => {
    const r = new RegExp(src, fl)
    const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => r.test(e.innerText))
    if (!el) return false
    el.click()
    return true
  }, sel, re.source, re.flags)

/** real mouse click / touch tap at an element's centre */
async function tap(p: Page, d: Dev, sel: string, nth = 0) {
  const h = (await p.$$(sel))[nth]
  if (!h) return false
  await h.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  const box = await h.boundingBox()
  if (!box) return false
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  if (d.touch) await p.touchscreen.tap(x, y)
  else await p.mouse.click(x, y)
  return true
}

async function layout(p: Page, name: string) {
  const r = await p.evaluate(() => {
    const de = document.documentElement
    const bad: string[] = []
    for (const e of document.querySelectorAll<HTMLElement>('.handrow .tile, .actions button, .cbtn, .chip, .info')) {
      const b = e.getBoundingClientRect()
      if (b.width === 0 && b.height === 0) continue
      if (b.left < -1 || b.right > innerWidth + 1 || b.top < -1 || b.bottom > innerHeight + 1) {
        bad.push(`${String(e.className).slice(0, 18)}@${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}`)
      }
    }
    return { sw: de.scrollWidth, iw: innerWidth, bad }
  })
  check(`${name}: no horizontal scroll`, r.sw <= r.iw + 1, `${r.sw} > ${r.iw}`)
  check(`${name}: nothing clipped off-screen`, r.bad.length === 0, r.bad.slice(0, 5).join(' | '))
}

/** one human turn with real input: select a tile, then confirm (Discard button, else second tap); pass on calls */
async function playTurn(p: Page, d: Dev): Promise<'discarded' | 'passed' | 'result' | 'idle'> {
  if (await p.$('.overlay .btn.gold')) return 'result'
  if (await p.$('.cbtn.pass')) {
    await tap(p, d, '.cbtn.pass')
    return 'passed'
  }
  const tiles = await p.$$('.handrow .tile.clickable')
  if (tiles.length) {
    await tap(p, d, '.handrow .tile.clickable', tiles.length - 1)   // first tap selects
    await sleep(150)
    await tap(p, d, '.handrow .tile.sel')                            // second tap on the same tile discards
    return 'discarded'
  }
  return 'idle'
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    for (const lang of LANGS) {
      for (const d of DEVICES) {
        const tag = `${d.name}/${lang}`
        const p = await newPage(browser, d, lang)
        await p.goto(BASE, { waitUntil: 'networkidle0' })
        const t = await text(p)
        check(`${tag}: start screen shows the play buttons`, lang === 'en' ? /Play vs bots/i.test(t) && /Play with friends/i.test(t) : /對戰電腦/.test(t) && /和朋友玩/.test(t))
        await layout(p, `${tag} menu`)
        await p.screenshot({ path: `${SHOTS}/${d.name}-${lang}-menu.png` })
        await clickText(p, '.btn.big', lang === 'en' ? /vs bots/i : /對戰電腦/)
        await sleep(450)
        const t2 = await text(p)
        check(`${tag}: rules step shows the three rule cards`, lang === 'en' ? /Taiwanese/.test(t2) && /Hong Kong/.test(t2) && /Riichi/.test(t2) : /台灣麻將/.test(t2))
        await layout(p, `${tag} rules step`)
        await p.click('button.rule')
        await sleep(450)
        await p.screenshot({ path: `${SHOTS}/${d.name}-${lang}-menu-options.png` })
        await layout(p, `${tag} menu+options`)

        await clickText(p, 'button', lang === 'en' ? /Rules reference/ : /規則說明/)
        await sleep(200)
        check(`${tag}: rules reference opens`, (await p.$('.modal table.ref')) !== null)
        await p.screenshot({ path: `${SHOTS}/${d.name}-${lang}-rules.png` })
        await layout(p, `${tag} rules`)
        await clickText(p, '.modal .btn', lang === 'en' ? /Close/ : /關閉/)
        await sleep(100)

        await clickText(p, '.btn.big', lang === 'en' ? /Continue/i : /繼續/)
        await sleep(450)
        await clickText(p, '.btn.big', lang === 'en' ? /Start game/i : /開始遊戲/)
        await p.waitForSelector('.handrow .tile', { timeout: 8000 })
        const nHand = await p.$$eval('.handrow .tile', (e) => e.length)
        check(`${tag}: game starts, hand drawn (${nHand} tiles)`, nHand >= 16)
        await sleep(600)
        await p.screenshot({ path: `${SHOTS}/${d.name}-${lang}-game.png` })
        await layout(p, `${tag} game`)

        if (!d.touch) {
          await p.waitForSelector('.handrow .tile.clickable', { timeout: 90000 }) // the dealer is random now: wait for our turn
          const before = await p.$$eval('.pond.p0 .tile', (e) => e.length)
          await p.keyboard.press('ArrowLeft')
          await sleep(150)
          check(`${tag}: ArrowLeft selects a tile`, (await p.$('.handrow .tile.sel')) !== null)
          await p.keyboard.press('Enter')
          await sleep(500)
          const after = await p.$$eval('.pond.p0 .tile', (e) => e.length)
          check(`${tag}: Enter discards the selected tile`, after === before + 1, `${before} -> ${after}`)
        } else if (d.name === 'phone') {
          // phones play in landscape; the table is never rotated by the app any more
          check(`${tag}: the table is not rotated`, (await p.$eval('.stagewrap', (e) => (e as HTMLElement).dataset.rotated)) !== '1')
        }
        let discards = 0
        for (let i = 0; i < 60 && discards < 4; i++) {
          const r = await playTurn(p, d)
          if (r === 'discarded') discards++
          if (r === 'result') break
          await sleep(r === 'idle' ? 400 : 250)
        }
        const pond = await p.$$eval('.pond.p0 .tile', (e) => e.length)
        check(`${tag}: tap a tile twice puts tiles in my pond (${pond})`, pond >= 1)
        await p.screenshot({ path: `${SHOTS}/${d.name}-${lang}-game2.png` })
        await layout(p, `${tag} game later`)

        await p.click('.dock summary')
        await sleep(100)
        check(`${tag}: auto menu opens`, (await p.$('.dockpanel')) !== null)
        await clickText(p, '.menuitem', lang === 'en' ? /Round history/ : /對局紀錄/)
        await sleep(150)
        check(`${tag}: history panel opens`, (await p.$('.modal')) !== null)
        await p.screenshot({ path: `${SHOTS}/${d.name}-${lang}-history.png` })
        await clickText(p, '.modal .btn', lang === 'en' ? /Close/ : /關閉/)
        await sleep(100)
        await p.close()
      }
    }
  } finally {
    await browser.close()
  }
  console.log(fails ? `\n${fails} FAILED` : '\nall UI checks passed')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
