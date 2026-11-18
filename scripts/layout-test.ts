import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE ?? 'http://localhost:5199'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const WIDTHS = (process.env.WIDTHS ?? '320,360,375,390,414,480,540,600,640,700,768,820,900,1024,1180,1280,1366,1440,1600,1920,2560').split(',').map(Number)
const HEIGHTS = (process.env.HEIGHTS ?? '568,640,700,768,800,900,1024,1080,1440').split(',').map(Number)
const STATES = (process.env.STATES ?? 'full,call,min,scfull,scswap,scvoid').split(',')
const PLAYERS = (process.env.PLAYERS ?? '4,3').split(',')

const probe = () => {
  { const d = document.querySelector<HTMLDetailsElement>('.dock'); if (d) d.open = true; [...document.querySelectorAll<HTMLElement>('.dockpanel .menuitem')].find((e) => /chat|聊天|快速/i.test(e.textContent ?? ''))?.click() } // chat picker open: its buttons must be reachable too
  const q = (s: string) => [...document.querySelectorAll<HTMLElement>(s)]
  const vis = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const R = (e: HTMLElement) => e.getBoundingClientRect()
  const problems: string[] = []
  const board = document.querySelector<HTMLElement>('.board')
  if (!board) return ['no board']
  const bb = R(board)

  // 1. page overflow
  if (document.documentElement.scrollWidth > innerWidth + 1) problems.push(`h-scroll ${document.documentElement.scrollWidth}>${innerWidth}`)

  // the real-size hand bar sits under the table: inside the screen, hand tiles never clipped sideways, pop-up inside the screen
  {
    const hb = document.querySelector<HTMLElement>('.handbar')
    if (hb) {
      const r = R(hb)
      if (r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) problems.push(`hand bar outside the screen (${Math.round(r.left)}..${Math.round(r.right)}, bottom ${Math.round(r.bottom)} vs ${innerWidth}x${innerHeight})`)
      const sw = document.querySelector<HTMLElement>('.stagewrap')
      if (sw && R(sw).bottom > r.top + 1) problems.push('table overlaps the hand bar')
      for (const t of q('.handrow .tile')) { const tr = R(t); if (tr.left < -1 || tr.right > innerWidth + 1) { problems.push('a hand tile is clipped sideways'); break } }
      const tiles = q('.handrow .tile')
      if (tiles.length && R(tiles[0]).width < 22) problems.push(`hand tile too small (${R(tiles[0]).width.toFixed(1)}px)`)
      const pop = document.querySelector<HTMLElement>('.actionpop')
      if (pop) { const pr = R(pop); if (pr.left < -1 || pr.right > innerWidth + 1 || pr.top < -1) problems.push(`action pop-up outside the screen (${Math.round(pr.left)}..${Math.round(pr.right)}, top ${Math.round(pr.top)})`) }
    }
  }

  // 2/3/4. layout blocks: no overlap, inside the board, inside the viewport horizontally
  const blocks: [string, HTMLElement][] = []
  const add = (name: string, sel: string) => q(sel).forEach((e, i) => { if (vis(e)) blocks.push([`${name}${i}`, e]) })
  add('pond', '.pond'); add('info', '.info'); add('dorapanel', '.dorapanel')
  for (const side of ['top', 'left', 'right']) { add(`${side}.chip`, `.seat.${side} > .chip`); add(`${side}.backs`, `.seat.${side} > .backs`); add(`${side}.extras`, `.seat.${side} > .extras`) }
  for (const [n, e] of blocks) {
    const r = R(e)
    if (r.left < bb.left - 1 || r.right > bb.right + 1) problems.push(`${n} outside board horizontally (${Math.round(r.left)}..${Math.round(r.right)} vs ${Math.round(bb.left)}..${Math.round(bb.right)})`)
    if (r.top < bb.top - 1 || r.bottom > bb.bottom + 1) problems.push(`${n} clipped vertically by the board (${Math.round(r.top)}..${Math.round(r.bottom)} vs ${Math.round(bb.top)}..${Math.round(bb.bottom)})`)
  }
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = R(blocks[i][1]), b = R(blocks[j][1])
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (w > 3 && h > 3) problems.push(`overlap ${blocks[i][0]} x ${blocks[j][0]} (${Math.round(w)}x${Math.round(h)})`)
    }
  }

  // 5. the dock menu: its button is on screen, and when opened the whole panel fits the screen
  const dock = document.querySelector<HTMLDetailsElement>('.dock')
  if (dock) {
    dock.open = true
    const pr = R(dock.querySelector<HTMLElement>('.dockpanel')!)
    if (pr.left < -2 || pr.top < -2 || pr.right > innerWidth + 2 || pr.bottom > innerHeight + 2) problems.push(`dock panel outside the screen (${Math.round(pr.left)},${Math.round(pr.top)} ${Math.round(pr.right)},${Math.round(pr.bottom)} in ${innerWidth}x${innerHeight})`)
    for (const e of [...dock.querySelectorAll<HTMLElement>('.dockpanel button, .dockpanel label')]) {
      const r = R(e)
      if (r.width < 20 || r.height < 20) problems.push(`dock control too small: ${e.textContent?.trim().slice(0, 12)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    dock.open = false
  }

  // 5b. tiles in the same row/block never intersect or cover each other (rivers, hands, melds, flowers, backs)
  {
    const parents = new Set<HTMLElement>()
    q('.tile, .sw').forEach((e) => { if (e.parentElement && !e.closest('.modal') && !e.closest('.actionpop') && !e.closest('.dorapanel')) parents.add(e.parentElement) })
    let reported = 0
    for (const par of parents) {
      const kids = [...par.children].filter((c) => (c.classList.contains('tile') || c.classList.contains('sw')) && vis(c as HTMLElement)) as HTMLElement[]
      for (let i = 0; i < kids.length && reported < 3; i++) for (let j = i + 1; j < kids.length && reported < 3; j++) {
        const a = R(kids[i]), b = R(kids[j])
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (w > 1.5 && h > 1.5) { reported++; problems.push(`tiles overlap in ${par.className.toString().slice(0, 24)} (${Math.round(w)}x${Math.round(h)} px)`) }
      }
    }
  }

  // 5c. a river never spills out of its own block
  for (const pond of q('.pond')) {
    const pr = R(pond)
    for (const t of [...pond.querySelectorAll<HTMLElement>('.tile, .sw')].filter(vis)) {
      const r = R(t)
      if (r.left < pr.left - 2 || r.right > pr.right + 2 || r.top < pr.top - 2 || r.bottom > pr.bottom + 2) { problems.push(`river tiles spill out of their block (${pond.className.toString().slice(0, 20)})`); break }
    }
  }

  // 6. tile sizes stay readable
  const handTile = q('.handrow .tile')[0]
  void handTile
  const pondTile = q('.pond .tile:not(.called)')[0]
  if (pondTile) { const r = R(pondTile), side = Math.min(r.width, r.height); if (side < 5.5) problems.push(`pond tile too small (${side.toFixed(1)}px short side)`) } // ponds are rotated toward each seat, so measure the short side
  const meTile = q('.mebar .tile')[0]
  if (meTile && R(meTile).width < 9) problems.push(`own meld tile too small (${R(meTile).width.toFixed(1)}px)`)

  // 7. every button / clickable tile is reachable (not covered) and buttons do not overlap each other
  const clickables = q('.board button, .dock summary, .actionpop button, .handrow .tile.clickable').filter((e) => vis(e) && !e.closest('details:not([open]) > :not(summary)'))
  const rects: [string, DOMRect][] = []
  for (const e of clickables) {
    e.scrollIntoView({ block: 'center', inline: 'center' })
    const r = R(e)
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) { problems.push(`button off-screen: ${String(e.className).slice(0, 24)} ${e.textContent?.trim().slice(0, 10)}`); continue }
    const top = document.elementFromPoint(cx, cy)
    if (!top || !(e === top || e.contains(top))) problems.push(`button covered by ${String((top as HTMLElement | null)?.className ?? top).slice(0, 30)}: ${String(e.className).slice(0, 20)} "${e.textContent?.trim().slice(0, 12)}"`)
    rects.push([`${String(e.className).slice(0, 14)}"${e.textContent?.trim().slice(0, 8)}"`, r])
  }
  window.scrollTo(0, 0)
  const nonTile = rects.filter(([n]) => !/tile/.test(n))
  for (let i = 0; i < nonTile.length; i++) for (let j = i + 1; j < nonTile.length; j++) {
    const a = nonTile[i][1], b = nonTile[j][1]
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) problems.push(`buttons overlap: ${nonTile[i][0]} x ${nonTile[j][0]} A=${Math.round(a.left)},${Math.round(a.top)},${Math.round(a.right)},${Math.round(a.bottom)} B=${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}`)
  }
  return problems
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  const LANG = process.env.LANG_UI ?? 'en'
  await page.evaluateOnNewDocument((l) => { (window as any).__LANG = l; (window as any).__name = (f: unknown) => f; try { localStorage.setItem('kiiro-lang', (window as any).__LANG ?? 'en') } catch { /* ignore */ } }, LANG)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  const failures = new Map<string, string[]>()
  let total = 0
  for (const players of PLAYERS) {
    for (const state of STATES) {
      await page.setViewport({ width: 1280, height: 800 })
      const jp = state.startsWith('jp')
      const sc = state.startsWith('sc')
      await page.goto(`${BASE}/?stress=${jp || sc ? state.slice(2) || 'full' : state}&players=${players}${jp ? '&rule=riichi' : sc ? '&rule=sichuan' : ''}`, { waitUntil: 'networkidle0' })
      for (const w of WIDTHS) {
        for (const h of HEIGHTS) {
          const touch = w < 900
          await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: touch, isMobile: false })
          await new Promise((r) => setTimeout(r, 120))
          const all = await page.evaluate(probe)
          // portrait phones get the 'turn your phone' prompt, so only the basics are checked there
          const supported = w >= h * 1.3 || Math.min(w, h) >= 600
          const probs = (supported ? all : all.filter((x) => /h-scroll|no board/.test(x))).filter((x) => !/covered by chat/.test(x)) // the chat picker is a closable overlay
          total++
          for (const p of probs) {
            const key = `[${state}/${players}p] ${process.env.RAW ? p : p.replace(/\d+(\.\d+)?/g, '#')}`
            const arr = failures.get(key) ?? []
            arr.push(`${w}x${h}`)
            failures.set(key, arr)
          }
        }
      }
    }
  }
  await browser.close()
  console.log(`checked ${total} window sizes`)
  if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 5))
  if (!failures.size && !errors.length) console.log('all layout checks passed at every size')
  for (const [k, sizes] of [...failures.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 40)) {
    console.log(`FAIL ${k}\n     at ${sizes.length} sizes: ${sizes.slice(0, 8).join(', ')}${sizes.length > 8 ? ' …' : ''}`)
  }
  process.exit(failures.size || errors.length ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
