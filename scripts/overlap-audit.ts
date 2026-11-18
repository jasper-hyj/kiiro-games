import puppeteer from 'puppeteer-core'

/** Visits every screen at many viewport sizes and languages and reports anything that overlaps:
 *  text over text, text under a control, control over control, and visible text that another element covers.
 *  (Tile art, pips and the table's rotated rivers are layered on purpose and are skipped.) */
const BASE = process.env.BASE ?? 'http://localhost:5199'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const click = (p: any, s: string) => p.evaluate((x: string) => (document.querySelector(x) as HTMLElement | null)?.click(), s)
const clickNth = (p: any, s: string, n: number) => p.evaluate((x: string, i: number) => (document.querySelectorAll(x)[i] as HTMLElement | undefined)?.click(), s, n)

const probe = () => {
  const SKIP = '.tile, .sw, svg, .pondin, .pip, .bam, .t'
  const describe = (e: Element) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`
  const visible = (e: Element) => { if (e.closest('details:not([open])') && !e.closest('summary')) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 }
  const items: { el: Element; r: DOMRect; text: string; kind: 'text' | 'ctl' }[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = (n.textContent ?? '').trim()
    const el = n.parentElement
    if (!t || !el || el.closest(SKIP) || !visible(el)) continue
    const range = document.createRange(); range.selectNodeContents(n)
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1)
    if (!rects.length) continue
    const L = Math.min(...rects.map((r) => r.left)), T = Math.min(...rects.map((r) => r.top)), R = Math.max(...rects.map((r) => r.right)), B = Math.max(...rects.map((r) => r.bottom))
    if (R < 0 || B < 0 || L > innerWidth || T > innerHeight) continue
    items.push({ el, r: new DOMRect(L, T, R - L, B - T), text: t.slice(0, 24), kind: 'text' })
  }
  for (const el of document.querySelectorAll('button, summary, input, select, a[href], label.switch')) {
    if (el.closest(SKIP) || !visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue
    items.push({ el, r, text: (el.textContent ?? '').trim().slice(0, 24), kind: 'ctl' })
  }
  // text scrolled out of (or clipped by) a scrolling / overflow-hidden ancestor is not visible: ignore it
  const clippedAway = (el: Element, r: DOMRect) => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue
      const ar = a.getBoundingClientRect()
      if (cx < ar.left || cx > ar.right || cy < ar.top || cy > ar.bottom) return true
    }
    return false
  }
  for (let i = items.length - 1; i >= 0; i--) if (clippedAway(items[i].el, items[i].r)) items.splice(i, 1)
  // while a modal is open only the modal counts: the page behind it is dimmed and unreachable
  const modal = document.querySelector('.overlay')
  const panel = document.querySelector('details[open] > .dockpanel') // the open in-game menu floats over the table on purpose
  if (panel) for (let i = items.length - 1; i >= 0; i--) if (!panel.contains(items[i].el) && !items[i].el.closest('summary')) items.splice(i, 1)
  if (modal) for (let i = items.length - 1; i >= 0; i--) if (!modal.contains(items[i].el)) items.splice(i, 1)
  const inter = (a: DOMRect, c: DOMRect) => Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left)) * Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top))
  const out: string[] = []
  const seen = new Set<string>()
  const push = (k: string, a: typeof items[0], c: typeof items[0] | null, extra = '') => {
    const key = `${k}|${describe(a.el)}|${c ? describe(c.el) : ''}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(`${k}: "${a.text}" <${describe(a.el)}>${c ? ` x "${c.text}" <${describe(c.el)}>` : ''}${extra}`)
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], c = items[j]
      if (a.el === c.el || a.el.contains(c.el) || c.el.contains(a.el)) continue
      if (a.el.closest('.title') && c.el.closest('.title')) continue // the tight 麻雀 / KIIRO MAHJONG lock-up overlaps only by font metrics
      if (a.kind === 'ctl' && c.kind === 'text' && a.el.contains(c.el)) continue
      const area = inter(a.r, c.r)
      if (area <= 0) continue
      const small = Math.min(a.r.width * a.r.height, c.r.width * c.r.height)
      if (a.kind === 'text' && c.kind === 'text') { if (area > Math.max(8, small * 0.12)) push('TEXT OVER TEXT', a, c) }
      else if (a.kind === 'ctl' && c.kind === 'ctl') { if (area > small * 0.1) push('CONTROL OVER CONTROL', a, c) }
      else { const t = a.kind === 'text' ? a : c, k = a.kind === 'text' ? c : a; if (!k.el.contains(t.el) && area > Math.max(8, t.r.width * t.r.height * 0.15)) push('TEXT UNDER CONTROL', t, k) }
    }
  }
  // text that is visible but covered by something unrelated (not a modal backdrop)
  for (const it of items) {
    if (it.kind !== 'text') continue
    const x = Math.min(innerWidth - 1, Math.max(0, it.r.left + it.r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, it.r.top + it.r.height / 2))
    const top = document.elementFromPoint(x, y)
    if (!top || top === it.el || it.el.contains(top) || top.contains(it.el)) continue
    if (top.closest('.overlay') && !it.el.closest('.overlay')) continue
    if (top === document.documentElement || top === document.body) continue
    push('TEXT COVERED', it, null, ` by <${describe(top)}>`)
  }
  // horizontal overflow of the page
  if (document.documentElement.scrollWidth > innerWidth + 2) out.push(`PAGE SCROLLS SIDEWAYS (${document.documentElement.scrollWidth} > ${innerWidth})`)
  return out
}

const VIEWPORTS: [number, number, boolean][] = [[1440, 900, false], [1280, 720, false], [1024, 768, true], [768, 1024, true], [844, 390, true], [932, 430, true], [667, 375, true], [390, 844, true], [360, 640, true]]
const report = new Map<string, Set<string>>()
const record = (where: string, list: string[]) => { for (const l of list) { if (!report.has(l)) report.set(l, new Set()); report.get(l)!.add(where) } }
let states = 0
const only = process.env.ONLY
for (const [w, h, touch] of VIEWPORTS) {
  for (const lang of (process.env.LANGS ?? 'en,zh,ja').split(',')) {
    const open = async (url: string) => {
      const p = await b.newPage()
      await p.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch })
      await p.evaluateOnNewDocument((l) => { try { localStorage.setItem('kiiro-lang', l) } catch { /* ignore */ } ; (window as any).__name = (f: unknown) => f }, lang)
      await p.goto(BASE + url, { waitUntil: 'networkidle0' })
      await sleep(350)
      return p
    }
    const check = async (p: any, name: string) => { states++; record(`${w}x${h}/${lang}/${name}`, await p.evaluate(probe)) }
    const run = async (name: string, fn: () => Promise<void>) => { if (only && !name.includes(only)) return; try { await fn() } catch (e) { console.log('STATE FAILED', name, String(e).slice(0, 100)) } }

    await run('menu', async () => {
      const p = await open('/')
      await check(p, 'home')
      await click(p, '.btn.felt'); await sleep(450); await check(p, 'rules step')
      for (const i of [0, 1, 2, 3, 4]) {
        await clickNth(p, 'button.rule', i); await sleep(450); await check(p, `options ${i}`)
        await click(p, '.btn.gold.big'); await sleep(450); await check(p, `name ${i}`)
        await click(p, '.backbtn'); await sleep(250); await click(p, '.backbtn'); await sleep(350)
      }
      await p.close()
    })
    await run('guide', async () => {
      const p = await open('/')
      await p.evaluate(() => { for (const x of [...document.querySelectorAll('.rulesfab')] as HTMLElement[]) if (/🎓/.test(x.textContent ?? '')) { x.click(); break } })
      await sleep(350)
      for (const n of [0, 2, 3, 6, 9]) { await clickNth(p, '.gstep', n); await sleep(150); await check(p, `guide ${n + 1}`) }
      await p.close()
    })
    await run('rulebook', async () => {
      const p = await open('/')
      await p.evaluate(() => { for (const x of [...document.querySelectorAll('.rulesfab')] as HTMLElement[]) if (/📖/.test(x.textContent ?? '')) { x.click(); break } })
      await sleep(350)
      for (const n of [0, 1, 2, 3, 4, 5]) { await clickNth(p, '.tabs button', n); await sleep(200); await check(p, `rulebook ${n}`) }
      await p.close()
    })
    await run('lobby', async () => {
      for (const rule of ['taiwan', 'riichi']) { const p = await open(`/?stress=lobby&rule=${rule}`); await check(p, `lobby ${rule}`); await p.close() }
    })
    await run('table', async () => {
      if (w <= 480 && h > w) return // portrait phones show the 'turn your phone' screen instead of the table
      for (const [mode, rule, pl] of [['full', 'riichi', 4], ['full', 'taiwan', 4], ['call', 'taiwan', 4], ['call', 'riichi', 3], ['swap', 'sichuan', 4], ['void', 'sichuan', 4], ['min', 'hk', 4]] as const) {
        const p = await open(`/?stress=${mode}&players=${pl}&rule=${rule}`)
        await check(p, `table ${mode}/${rule}/${pl}`)
        if (mode === 'full' && rule === 'riichi') {
          await click(p, '.dock summary'); await sleep(300); await check(p, 'table dock open')
          await click(p, '.dock summary'); await sleep(150)
          await click(p, '.rulechip'); await sleep(400); await check(p, 'table rule chip -> rules')
        }
        await p.close()
      }
    })
  }
}
await b.close()
console.log(`${states} screens checked`)
const rows = [...report.entries()].sort((a, c) => c[1].size - a[1].size)
for (const [issue, where] of rows) console.log(`${String(where.size).padStart(3)}x  ${issue}\n       e.g. ${[...where].slice(0, 3).join(' | ')}`)
console.log(rows.length ? `\n${rows.length} distinct overlap problems` : '\nno overlaps found')
process.exit(rows.length ? 1 : 0)
