import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/tools/padding-audit.ts <outDir> [port] [page,...]   (wrangler :8787 + vite :5200) Text must never sit tight against the edge of the
// box it is in: for every piece of text inside something with a background, border or rim, measures the gap to that edge, on phones and a desktop.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const only = process.argv[4]?.split(',')
const base = `http://localhost:${port}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const GAMES = [
  'holdem',
  'blackjack',
  'bigtwo',
  'mahjong',
  'gomoku',
  'crazyeights',
  'yahtzee',
  'liarsdice',
  'chess',
  'xiangqi',
  'doudizhu',
  'bridge',
  'hearts',
  'spades',
  'go',
  'checkers',
  'reversi',
  'chinesecheckers',
]
const click = (p: Page, sel: string) => p.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel)
const PAGES: [string, string, ((p: Page) => Promise<unknown>)?][] = [
  ['hub', '/'],
  ['hub-picked', '/', (p) => click(p, '.kg-obj:nth-child(5)')],
  ['board', '/', (p) => p.evaluate(() => document.querySelector('.kg-board')?.scrollIntoView())],
  ['signin', '/', (p) => click(p, '.kg-acct')],
  ['room', '/room/new?game=mahjong'],
  ['room-holdem', '/room/new?game=holdem'],
  ['room-landing', '/room'],
  ['no-table', '/holdem/1113'],
  ['admin', '/admin'],
  ['help', '/chess/practice', (p) => click(p, '.k-helpbtn')],
  ['resign', '/chess/practice', (p) => p.evaluate(() => (Array.from(document.querySelectorAll('.chfoot button')).pop() as HTMLElement | undefined)?.click())],
  ['mj-menu', '/mahjong/practice?stress=full&players=4&rule=riichi', (p) => click(p, '.dock summary')],
  [
    'mj-rules',
    '/mahjong/practice?stress=full&players=4&rule=riichi',
    async (p) => {
      await click(p, '.dock summary')
      await sleep(300)
      await click(p, '.dockpanel .rulesbtn')
    },
  ],
  ...GAMES.map((g): [string, string] => [g, `/${g}/practice`]),
]
const probe = `(() => {
  const found = []
  const boxed = (e) => {
    if (e === document.body || e === document.documentElement) return false
    if (e.matches('.kg, .app, .kg-wrap, main, .overlay, .acmodal, .pkcard, .tile, .yzdie, .ldmini, .chsq, .cksq, .rvsq, .k-av, svg, svg *')) return false
    const s = getComputedStyle(e)
    const bg = s.backgroundColor.match(/[\\d.]+/g)
    const alpha = bg ? (bg.length > 3 ? Number(bg[3]) : 1) : 0
    const painted = alpha > 0.04 || s.backgroundImage.includes('gradient')
    const edged = (parseFloat(s.borderLeftWidth) > 0 && s.borderLeftStyle !== 'none') || (parseFloat(s.borderBottomWidth) >= 1 && parseFloat(s.borderTopWidth) >= 1) || /inset/.test(s.boxShadow)
    return painted || edged
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walker.nextNode())) {
    const text = (n.textContent || '').trim()
    const el = n.parentElement
    if (!text || !el || el.closest('.pkcard, .tile, svg, .k-av, [aria-hidden=true], .yzsheet, .brauction, option')) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.2) continue
    const range = document.createRange(); range.selectNodeContents(n)
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1)
    if (!rects.length) continue
    let box = el
    while (box && !boxed(box)) box = box.parentElement
    if (!box) continue
    const b = box.getBoundingClientRect()
    if (b.width <= 34 || b.height <= 18) continue
    // only what is on the screen and really shows
    if (rects[0].bottom < 0 || rects[0].top > innerHeight) continue
    const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, rects[0].left + rects[0].width / 2)), rects[0].top + rects[0].height / 2)
    if (hit && !box.contains(hit) && !hit.contains(box)) continue
    // the ink is narrower than the line box above and below; sideways the box of the text is the text
    const ell = getComputedStyle(el).textOverflow === 'ellipsis'
    const left = Math.min(...rects.map((r) => r.left)) - b.left
    const right = ell ? 99 : b.right - Math.max(...rects.map((r) => r.right))
    const top = Math.min(...rects.map((r) => r.top + r.height * 0.12)) - b.top
    const bottom = b.bottom - Math.max(...rects.map((r) => r.bottom - r.height * 0.12))
    const side = Math.min(left, right), vert = Math.min(top, bottom)
    if (side < 6 || vert < 2.5) {
      const cls = (box.getAttribute('class') || box.tagName).split(' ').slice(0, 2).join('.')
      found.push(cls + ' | "' + text.slice(0, 26) + '" | sides ' + Math.round(left) + '/' + Math.round(right === 99 ? -99 : right) + ' top/bottom ' + Math.round(top) + '/' + Math.round(bottom))
    }
  }
  return found
})()`
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const report = new Map<string, string[]>()
for (const [name, path, act] of PAGES) {
  if (only && !only.includes(name)) continue
  for (const [w, h, lang] of [
    [320, 568, 'en'],
    [390, 844, 'zh'],
    [375, 667, 'ja'],
    [1280, 800, 'en'],
  ] as const) {
    const p = await (await b.createBrowserContext()).newPage()
    await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
    await p.evaluateOnNewDocument((l: string) => localStorage.setItem('kiiro-lang', l), lang)
    await p.goto(base + path, { waitUntil: 'domcontentloaded' })
    await sleep(1600)
    if (act) await act(p).catch(() => {})
    await sleep(600)
    const found = (await p.evaluate(probe)) as string[]
    for (const f of found) {
      const key = name + ' | ' + f.split(' | ')[0]
      if (!report.has(key)) report.set(key, [])
      report.get(key)!.push(`${w} ${lang}: ${f.split(' | ').slice(1).join(' | ')}`)
    }
    if (found.length) await p.screenshot({ path: `${out}/pad-${name}-${w}.png` })
    await p.browserContext().close()
  }
}
await b.close()
for (const [key, list] of report) console.log(`${key}  (${list.length})\n    ${list.slice(0, 2).join('\n    ')}`)
console.log(report.size ? `\n${report.size} places to look at` : '\nno tight text')
process.exit(0)
