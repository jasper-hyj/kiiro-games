import puppeteer from 'puppeteer-core'

/** Finds text that is hard to read: every visible text node's colour is compared with the first reasonably opaque
 *  background behind it (gradients use their first/last stop). Anything below a contrast ratio of 3 is reported. */
const BASE = process.env.BASE ?? 'http://localhost:5199'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const probe = () => {
  const parse = (c: string): [number, number, number, number] | null => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  const lum = (r: number, g: number, bl: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl) }
  const cr = (a: number, b2: number) => (Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05)
  const bgOf = (el: Element): [number, number, number] => {
    // walk up, blending translucent layers over the page colour
    const layers: [number, number, number, number][] = []
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      const bi = cs.backgroundImage
      const stops = bi.match(/rgba?\([^)]+\)/g)
      if (stops && stops.length) {
        const cols = stops.map((s) => parse(s)!).filter(Boolean)
        const avg: [number, number, number, number] = [0, 0, 0, 0]
        for (const c of cols) { avg[0] += c[0]; avg[1] += c[1]; avg[2] += c[2]; avg[3] += c[3] }
        const n = cols.length
        layers.push([avg[0] / n, avg[1] / n, avg[2] / n, avg[3] / n])
        if (avg[3] / n > 0.9) break
      }
      const bc = parse(cs.backgroundColor)
      if (bc && bc[3] > 0) { layers.push(bc); if (bc[3] > 0.9) break }
    }
    let r = 6, g = 10, bl = 24 // the page is near-black navy
    for (const l of layers.reverse()) { r = l[0] * l[3] + r * (1 - l[3]); g = l[1] * l[3] + g * (1 - l[3]); bl = l[2] * l[3] + bl * (1 - l[3]) }
    return [r, g, bl]
  }
  const bad: string[] = []
  const seen = new Set<string>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = (n.textContent ?? '').trim()
    const el = n.parentElement
    if (!t || !el) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.2) continue
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.color === 'rgba(0, 0, 0, 0)') continue // gradient-clipped glyphs
    const fg = parse(cs.color)
    if (!fg) continue
    const bg = bgOf(el)
    const fgBlend: [number, number, number] = [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3])]
    const ratio = cr(lum(...fgBlend), lum(...bg))
    const fs = parseFloat(cs.fontSize)
    const need = fs >= 24 ? 2.2 : 3
    if (ratio < need) {
      const key = `${el.className}|${t.slice(0, 20)}`
      if (!seen.has(key)) { seen.add(key); bad.push(`${ratio.toFixed(2)}  "${t.slice(0, 28)}"  <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 40)}">  fg=${cs.color} bg≈rgb(${bg.map(Math.round).join(',')})`) }
    }
  }
  return bad
}
let total = 0
const run = async (label: string, url: string, w: number, h: number, steps?: (p: any) => Promise<void>) => {
  const p = await b.newPage()
  await p.setViewport({ width: w, height: h })
  await p.evaluateOnNewDocument(() => { (window as any).__name = (f: unknown) => f; localStorage.setItem('kiiro-lang', 'en') })
  await p.goto(BASE + url, { waitUntil: 'networkidle0' })
  await sleep(500)
  if (steps) await steps(p)
  await sleep(300)
  const bad: string[] = await p.evaluate(probe)
  total += bad.length
  console.log(bad.length ? `FAIL ${label}` : `ok   ${label}`)
  for (const x of bad.slice(0, 8)) console.log('     ', x)
  await p.close()
}
const click = (p: any, sel: string) => p.evaluate((s: string) => (document.querySelector(s) as HTMLElement | null)?.click(), sel)
await run('home', '/', 1100, 700)
await run('rules step', '/', 1100, 700, async (p) => { await click(p, '.btn.felt'); await sleep(500) })
await run('options step', '/', 1100, 700, async (p) => { await click(p, '.btn.felt'); await sleep(500); await click(p, 'button.rule'); await sleep(500) })
await run('name step', '/', 1100, 700, async (p) => { await click(p, '.btn.felt'); await sleep(500); await click(p, 'button.rule'); await sleep(500); await click(p, '.btn.big'); await sleep(500) })
for (const rule of ['taiwan', 'riichi', 'sichuan']) {
  await run(`table ${rule}`, `/?stress=full&players=4&rule=${rule}`, 1280, 720)
  await run(`table call ${rule}`, `/?stress=call&players=4&rule=${rule}`, 1280, 720)
}
await run('dock open', '/?stress=full&players=4&rule=riichi', 1280, 720, async (p) => { await click(p, '.dock summary'); await sleep(300) })
await run('rules reference', '/?stress=full&players=4&rule=riichi', 1280, 720, async (p) => { await click(p, '.dock summary'); await sleep(200); await click(p, '.dockpanel .rulesbtn'); await sleep(400) })
await run('sichuan swap', '/?stress=swap&players=4&rule=sichuan', 1280, 720)
await run('sichuan void', '/?stress=void&players=4&rule=sichuan', 1280, 720)
await run('solo result', '/?solo=1&rule=taiwan&speed=0.02', 1280, 720, async (p) => {
  for (let i = 0; i < 500 && !(await p.$('.overlay .modal')); i++) {
    if (await p.$('.cbtn.ron')) await click(p, '.cbtn.ron'); else if (await p.$('.cbtn.pass')) await click(p, '.cbtn.pass')
    else { const t = await p.$$('.handrow .tile.clickable'); if (t.length) { await t[t.length - 1].click(); await sleep(40); await click(p, '.handrow .tile.sel') } }
    await sleep(50)
  }
})
await b.close()
console.log(total ? `\n${total} low-contrast text items` : '\nno low-contrast text found')
process.exit(total ? 1 : 0)
