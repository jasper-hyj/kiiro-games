import puppeteer from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/site/chat-clear-test.ts [outDir]   (wrangler :8787 + vite :5200) On real tables and the room, on phones, tablets and a desktop:
// the chat (button or box) must not lie on any tile, card, board, seat or button.
const out = process.argv[2] || '/tmp'
const only = process.argv[3]?.split(',')
const BASE = process.env.BASE ?? 'http://localhost:5200'
setTimeout(() => {
  console.log('FAIL TIMEOUT')
  process.exit(1)
}, 600000)
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const SIZES: [number, number][] = [
  [390, 664],
  [390, 844],
  [320, 568],
  [844, 390],
  [820, 1180],
  [1280, 800],
]
const TABLES: [string, object, string][] = [
  ['mahjong', { rule: 'taiwan' }, '.handrow .tile'],
  ['mahjong', { rule: 'riichi' }, '.handrow .tile'],
  ['holdem', { sb: 25, bb: 50, casual: true }, '.hdfelt'],
  ['blackjack', { bb: 10, casual: true }, '.bjtable'],
  ['bigtwo', {}, '.bthand'],
  ['crazyeights', {}, '.c8hand'],
  ['hearts', {}, '.tkhand'],
  ['spades', {}, '.tkhand'],
  ['doudizhu', {}, '.ddhand'],
  ['bridge', {}, '.br'],
  ['gomoku', { size: 15 }, '.gmboard'],
  ['chess', {}, '.chboard'],
  ['chinesecheckers', {}, '.ccboard'],
  ['yahtzee', {}, '.yzsheet'],
  ['liarsdice', {}, '.ld'],
  ['room', {}, '.rmpeople'],
]
const probe = `(() => {
  const chat = document.querySelector('.kgchat')
  if (!chat) return ['no chat on the page']
  const c = chat.getBoundingClientRect()
  if (c.width < 2 || c.height < 2) return []
  const out = []
  if (c.left < -1 || c.right > innerWidth + 1 || c.top < -1 || c.bottom > innerHeight + 1) out.push('chat leaves the screen')
  const sel = '.tile, .pkcard, .k-seat, .chip, button, input, select, .gmboard, .chboard, .ccboard, .rmdigits, .rmpeople li, .yzsheet td, .yzsheet th, .statusbar, .cgrid, .gmchip'
  for (const e of document.querySelectorAll(sel)) {
    if (chat.contains(e)) continue
    const r = e.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || getComputedStyle(e).visibility === 'hidden') continue
    if (Math.min(c.right, r.right) - Math.max(c.left, r.left) > 2 && Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top) > 2) out.push('covers ' + (e.getAttribute('class') || e.tagName).slice(0, 30))
  }
  return Array.from(new Set(out)).slice(0, 4)
})()`
for (const [game, cfg, ready] of TABLES) {
  if (only && !only.includes(game)) continue
  const url = game === 'room' ? `${BASE}/room/new` : await tableUrl(game, cfg)
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  const errors: string[] = []
  p.on('pageerror', (e: unknown) => errors.push((e as Error).message))
  await p.goto(url, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector(ready, { timeout: 25000 }).catch(() => errors.push('table did not appear'))
  await sleep(3000)
  for (const [w, h] of SIZES) {
    await p.setViewport({ width: w, height: h, hasTouch: true, isMobile: true }) // changing the touch flags would reload the page
    await sleep(1100)
    const found = (await p.evaluate(probe)) as string[]
    ok(found.length === 0, `${game}${'rule' in cfg ? ' ' + (cfg as { rule: string }).rule : ''} ${w}x${h}: chat is clear (${found.join('; ') || 'clean'})`)
    if (found.length || (game === 'mahjong' && h === 664)) await p.screenshot({ path: `${out}/chat-${game}-${w}x${h}.png` })
  }
  ok(errors.length === 0, `${game}: no page errors (${errors[0] ?? ''})`)
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
