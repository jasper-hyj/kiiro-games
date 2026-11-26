import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/tools/device-audit.ts <outDir> [port] [page,page...]   (wrangler :8787 + vite :5200)
// Every page on iPhones, iPads and Android tablets, upright and sideways, plus a sweep of widths in between. Reports: sideways scrolling, things off the
// screen, text cut off in buttons, boards that do not fit the screen, seats covering each other. Saves a screenshot wherever something is reported.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const only = process.argv[4]?.split(',')

const DEVICES: [string, number, number][] = [
  ['iPhone SE 1st', 320, 568],
  ['Android small', 360, 740],
  ['iPhone SE', 375, 667],
  ['iPhone 13 mini', 375, 812],
  ['iPhone 14', 390, 844],
  ['iPhone 15 Pro', 393, 852],
  ['iPhone Pro Max', 430, 932],
  ['iPhone 14 Safari bars', 390, 664],
  ['small tablet', 600, 960],
  ['iPad mini', 744, 1133],
  ['Android tablet', 800, 1280],
  ['iPad', 810, 1080],
  ['iPad Air', 820, 1180],
  ['iPad Pro 11', 834, 1194],
  ['iPad Pro 13', 1024, 1366],
]
const SIZES: [string, number, number][] = [
  ...DEVICES,
  ...DEVICES.map(([n, w, h]): [string, number, number] => [n + ' landscape', h, w]),
  ['iPhone 14 landscape Safari bars', 844, 340],
  ['iPhone SE landscape Safari bars', 667, 325],
  ...[440, 480, 520, 560, 640, 700, 900, 980].map((w): [string, number, number] => ['width ' + w, w, 800]),
  ['laptop', 1280, 720],
  ['laptop large', 1440, 900],
  ['desktop', 1920, 1080],
]
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
const PAGES: [string, string, string][] = [
  ['hub', '/', '.kg-obj'],
  ['room', '/room/new?game=holdem', '.rmpeople'],
  ...GAMES.map((g): [string, string, string] => [g, `/${g}/practice`, g === 'mahjong' ? '.board' : '.k-head']),
]

/** runs in the page */
const probe = `(() => {
  const found = []
  const iw = innerWidth, ih = innerHeight
  const root = document.querySelector('.kg') || document.scrollingElement
  const sw = Math.max(root.scrollWidth, document.scrollingElement.scrollWidth)
  if (sw > iw + 1) found.push('sideways scroll (' + sw + ' > ' + iw + ')')
  const visible = (e) => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 }
  const scrolls = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX) && !p.classList.contains('kg') && !p.classList.contains('app')) return true } return false }
  const name = (e) => (e.getAttribute('class') || e.tagName).toString().split(' ').slice(0, 2).join('.') + ' "' + (e.textContent || '').trim().slice(0, 18) + '"'
  let offs = 0
  for (const e of document.querySelectorAll('button, a, input, svg[role=grid], .k-seat, .pkcard, .tile, h1, h2, .gmchip, .rmdigits b')) {
    const q = e.getBoundingClientRect()
    if (!q.width || !visible(e) || scrolls(e)) continue
    if ((q.right > iw + 2 || q.left < -2) && offs++ < 3) found.push('off screen: ' + name(e) + ' ' + Math.round(q.left) + '..' + Math.round(q.right))
  }
  let cut = 0
  for (const e of document.querySelectorAll('button, .k-title b, .k-seatname span:last-child')) {
    if (!visible(e) || !e.getBoundingClientRect().width) continue
    const s = getComputedStyle(e)
    if (e.scrollWidth > e.clientWidth + 3 && s.textOverflow !== 'ellipsis' && e.clientWidth > 0 && !e.querySelector('svg') && !/card|sq|die|medal|hit/.test(e.className) && cut++ < 3) found.push('text cut off: ' + name(e))
  }
  // the board or table of a game should be wholly visible without scrolling
  const board = document.querySelector('.gmboard, .chboard, .xqboard, .ckboard, .rvboard, .ccboard')
  if (board) {
    const q = board.getBoundingClientRect()
    if (q.height > ih + 4) found.push('board taller than the screen (' + Math.round(q.height) + ' > ' + ih + ')')
    else if (q.bottom > ih + 12) found.push('board needs scrolling (bottom ' + Math.round(q.bottom) + ' of ' + ih + ')')
    if (Math.min(q.width, q.height) < Math.min(iw, ih) * 0.55) found.push('board small: ' + Math.round(q.width) + 'x' + Math.round(q.height) + ' on ' + iw + 'x' + ih)
  }
  const felt = document.querySelector('.hdfelt')
  if (felt) {
    const f = felt.getBoundingClientRect()
    const seats = Array.from(document.querySelectorAll('.hdseat:not(.empty)')).map((e) => e.getBoundingClientRect())
    const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 6 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 6
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) if (hit(seats[i], seats[j])) found.push('seats cover each other')
    const mid = document.querySelector('.hdboard')?.getBoundingClientRect()
    if (mid && seats.some((s) => hit(s, mid))) found.push('a seat covers the board cards')
    if (seats.some((s) => s.top < f.top - 18 || s.bottom > f.bottom + 18)) found.push('a seat hangs off the table')
  }
  const mj = document.querySelector('.app.game .board')
  if (mj) { const q = mj.getBoundingClientRect(); if (q.bottom > ih + 2 || q.right > iw + 2) found.push('mahjong table larger than the screen') }
  return Array.from(new Set(found))
})()`

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const report: Record<string, Record<string, string[]>> = {}
for (const [name, path, ready] of PAGES) {
  if (only && !only.includes(name)) continue
  const p: Page = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  const errors: string[] = []
  p.on('pageerror', (e: unknown) => errors.push((e as Error).message))
  await p.goto(`http://localhost:${port}${path}`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector(ready, { timeout: 20000 }).catch(() => errors.push('page did not appear'))
  await new Promise((r) => setTimeout(r, 1500))
  let shots = 0
  for (const [device, w, h] of SIZES) {
    await p.setViewport({ width: w, height: h, hasTouch: true, isMobile: true })
    await new Promise((r) => setTimeout(r, 320))
    await p.evaluate(`(document.querySelector('.kg') || document.scrollingElement).scrollTo(0, 0)`)
    const found = (await p.evaluate(probe)) as string[]
    for (const f of found) {
      const kind = f.replace(/\(.*?\)|-?\d+(\.\.-?\d+)?(x\d+)?/g, '#')
      ;((report[name] ??= {})[kind] ??= []).push(`${w}x${h} ${device}: ${f}`)
    }
    if (found.length && shots++ < 6) await p.screenshot({ path: `${out}/dev-${name}-${w}x${h}.png` })
  }
  for (const e of errors.slice(0, 2)) ((report[name] ??= {})['error'] ??= []).push(e)
  console.log(`checked ${name} on ${SIZES.length} sizes`)
  await p.browserContext().close()
}
await b.close()
let total = 0
for (const [name, kinds] of Object.entries(report)) {
  console.log(`\n${name}`)
  for (const list of Object.values(kinds)) {
    total += list.length
    console.log(`  ${list.length}x  e.g. ${list[0]}`)
    if (list.length > 1)
      console.log(
        `      also at: ${list
          .slice(1, 12)
          .map((l) => l.split(' ')[0])
          .join(', ')}`,
      )
  }
}
console.log(total ? `\n${total} findings` : '\nnothing found')
process.exit(0)
