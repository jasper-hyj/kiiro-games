import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE ?? 'http://localhost:5199'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const WIDTHS = (process.env.WIDTHS ?? '320,360,375,390,414,480,540,600,640,700,768,820,900,1024,1180,1280,1366,1440,1600,1920,2560').split(',').map(Number)
const HEIGHTS = (process.env.HEIGHTS ?? '568,640,700,768,800,900,1024,1080,1440').split(',').map(Number)
const STATES = (process.env.STATES ?? 'full,call,min').split(',')
const PLAYERS = (process.env.PLAYERS ?? '4,3').split(',')

const probe = () => {
  document.querySelector<HTMLElement>('.chatopen')?.click() // chat picker open: its buttons must be reachable too
  const q = (s: string) => [...document.querySelectorAll<HTMLElement>(s)]
  const vis = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const R = (e: HTMLElement) => e.getBoundingClientRect()
  const problems: string[] = []
  const board = document.querySelector<HTMLElement>('.board')
  if (!board) return ['no board']
  const bb = R(board)

  // 1. page overflow
  if (document.documentElement.scrollWidth > innerWidth + 1) problems.push(`h-scroll ${document.documentElement.scrollWidth}>${innerWidth}`)

  // 2/3/4. layout blocks: no overlap, inside the board, inside the viewport horizontally
  const blocks: [string, HTMLElement][] = []
  const add = (name: string, sel: string) => q(sel).forEach((e, i) => { if (vis(e)) blocks.push([`${name}${i}`, e]) })
  add('pond', '.pond'); add('info', '.info'); add('dorapanel', '.dorapanel')
  for (const side of ['top', 'left', 'right']) { add(`${side}.chip`, `.seat.${side} > .chip`); add(`${side}.backs`, `.seat.${side} > .backs`); add(`${side}.extras`, `.seat.${side} > .extras`) }
  add('mebar', '.mebar'); add('status', '.statusbar'); add('actions', '.actions'); add('callbar', '.callbar'); add('hint', '.hint'); add('hand', '.handrow')
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

  // 5. top bar items do not overlap each other
  const tb = [...document.querySelectorAll<HTMLElement>('.topbar > *')].filter(vis)
  for (let i = 0; i < tb.length; i++) for (let j = i + 1; j < tb.length; j++) {
    const a = R(tb[i]), b = R(tb[j])
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) problems.push(`topbar overlap ${tb[i].className || tb[i].tagName} x ${tb[j].className || tb[j].tagName}`)
  }
  if (document.querySelector('.topbar') && R(document.querySelector<HTMLElement>('.topbar')!).height > 70) problems.push('topbar wrapped to more than one row')

  // 6. tile sizes stay readable
  const handTile = q('.handrow .tile')[0]
  if (handTile && R(handTile).width < 16) problems.push(`hand tile too small (${R(handTile).width.toFixed(1)}px)`)
  const pondTile = q('.pond .tile:not(.called)')[0]
  if (pondTile && R(pondTile).width < 8) problems.push(`pond tile too small (${R(pondTile).width.toFixed(1)}px)`)
  const meTile = q('.mebar .tile')[0]
  if (meTile && R(meTile).width < 9) problems.push(`own meld tile too small (${R(meTile).width.toFixed(1)}px)`)

  // 7. every button / clickable tile is reachable (not covered) and buttons do not overlap each other
  const clickables = q('.board button, .topbar button, .topbar summary, .handrow .tile.clickable').filter((e) => vis(e) && !e.closest('details:not([open]) > :not(summary)'))
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
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) problems.push(`buttons overlap: ${nonTile[i][0]} x ${nonTile[j][0]}`)
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
      await page.goto(`${BASE}/?stress=${jp ? state.slice(2) || 'full' : state}&players=${players}${jp ? '&rule=riichi' : ''}`, { waitUntil: 'networkidle0' })
      for (const w of WIDTHS) {
        for (const h of HEIGHTS) {
          const touch = w < 900
          await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: touch, isMobile: false })
          await new Promise((r) => setTimeout(r, 40))
          const probs = await page.evaluate(probe)
          total++
          for (const p of probs) {
            const key = `[${state}/${players}p] ${p.replace(/\d+(\.\d+)?/g, '#')}`
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
