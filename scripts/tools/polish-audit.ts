import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/tools/polish-audit.ts   (wrangler :8787 + vite :5200)
// Looks for the small things that make a screen feel unfinished: button text that is not centred in its button, buttons whose
// keyboard focus shows nothing (or the browser's default blue ring), and a different look for the same kind of control.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 280000)
import { tableUrl } from '../lib/table'
const BASE = process.env.BASE ?? 'http://localhost:5200'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let problems = 0
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })

const AUDIT = `(() => {
  const out = { off: [], focus: [], ring: [] }
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 8 && r.height > 8 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth }
  const els = [...document.querySelectorAll('button, a.hdbtn, a.k-linkbtn, a.kg-create, a.kg-go, a.kg-practice, [role=button], [role=tab]')].filter(vis)
  for (const e of els) {
    const txt = (e.textContent || '').trim()
    if (!txt) continue
    const s = getComputedStyle(e)
    const range = document.createRange(); range.selectNodeContents(e)
    const lines = [...range.getClientRects()].filter((r) => r.width > 1)
    if (!lines.length) continue
    const box = e.getBoundingClientRect()
    const left = Math.min(...lines.map((r) => r.left)), right = Math.max(...lines.map((r) => r.right)), top = Math.min(...lines.map((r) => r.top)), bottom = Math.max(...lines.map((r) => r.bottom))
    const dx = (left + right) / 2 - (box.left + box.right) / 2, dy = (top + bottom) / 2 - (box.top + box.bottom) / 2
    if (e.classList.contains('menuitem')) continue // menu rows are left-aligned on purpose
    const isPill = box.height < 70 && box.width < 460
    if (isPill && (Math.abs(dx) > Math.max(4, box.width * 0.12) || Math.abs(dy) > 5)) out.off.push(e.tagName + '.' + String(e.className).slice(0, 40) + ' "' + txt.slice(0, 24) + '" dx=' + Math.round(dx) + ' dy=' + Math.round(dy))
  }
  return out
})()`

const FOCUS = `(async () => {
  const bad = []
  const els = [...document.querySelectorAll('button, a[href], input, select')].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 8 && r.height > 8 && s.visibility !== 'hidden' && s.display !== 'none' && !e.disabled && r.bottom > 0 && r.top < innerHeight })
  for (const e of els.slice(0, 30)) {
    e.focus({ focusVisible: true })
    await new Promise((r) => setTimeout(r, 30))
    if (document.activeElement !== e || e.closest('.kgin')) continue // not focusable from the keyboard (or the chat line, which lights its own edge)
    const s = getComputedStyle(e)
    const ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
    const shadow = s.boxShadow !== 'none'
    const color = s.outlineColor
    const def = ring && /rgb\\(16, 16, 16\\)|rgb\\(0, 95, 204\\)|rgb\\(0, 103, 244\\)|-webkit-focus-ring/.test(color)
    const label = e.tagName + '.' + String(e.className).slice(0, 30) + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20) + '"'
    if (!ring && !shadow) bad.push('no focus mark: ' + label)
    else if (def) bad.push('browser default ring: ' + label + ' ' + color)
  }
  return bad
})()`

const run = async (label: string, url: string, wait: string, w = 390, h = 844, act?: (p: import('puppeteer-core').Page) => Promise<void>) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto(url, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector(wait, { timeout: 20000 }).catch(() => {})
  await sleep(700)
  if (act) await act(p)
  const a = (await p.evaluate(AUDIT)) as { off: string[] }
  const f = (await p.evaluate(FOCUS)) as string[]
  for (const x of a.off) {
    problems++
    console.log(`  ${label} (${w}px): text not centred: ${x}`)
  }
  for (const x of f) {
    problems++
    console.log(`  ${label} (${w}px): ${x}`)
  }
  console.log(`${a.off.length + f.length === 0 ? 'ok  ' : 'ISSUES'} ${label} ${w}px`)
  await p.browserContext().close()
}

for (const w of [390, 1100]) {
  const h = w < 700 ? 844 : 800
  await run('hub', BASE + '/', '.kg-grid', w, h)
  await run('sign-in dialog', BASE + '/', '.kg-grid', w, h, async (p) => {
    await p.click('.kg-acct')
    await p.waitForSelector('.acbox')
    await sleep(300)
  })
  await run('create-account dialog', BASE + '/', '.kg-grid', w, h, async (p) => {
    await p.click('.kg-acct')
    await p.waitForSelector('.actabs')
    await p.click('.actabs button:nth-child(2)')
    await sleep(300)
  })
  await run('room landing', BASE + '/room', '.rmentry', w, h)
  await run('room', BASE + '/room/new?game=holdem', '.rmpeople', w, h)
  await run("hold'em practice", BASE + '/holdem/practice', '.hd-actions', w, h)
  await run("hold'em help", BASE + '/holdem/practice', '.hd-actions', w, h, async (p) => {
    await p.click('.k-helpbtn')
    await sleep(300)
  })
  await run('blackjack practice', BASE + '/blackjack/practice', '.bjchips', w, h)
  await run('big two practice', BASE + '/bigtwo/practice', '.bthand .btcard', w, h)
  await run('big two lobby', await tableUrl('bigtwo', {}), '.btlobby', w, h)
  await run('mahjong practice', BASE + '/mahjong/practice', '.handrow .tile', w, h)
}
await b.close()
console.log(problems ? `${problems} things to look at` : 'clean')
process.exit(0)
