import puppeteer, { type Page } from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/generic/gomoku-ui-test.ts   (wrangler :8787 + vite :5200) Gomoku in the browser: practice against the bot, a table with two people and a spectator, mouse and touch.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 200000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const page = async (touch = false) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1100, height: 850 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('PAGEERROR', (e as Error).message)
  })
  return p
}
const stones = (p: Page) => p.$$eval('.gmst', (e) => e.length)
/** the screen position of a point on the board (15 x 15: the grid spans 16 units of the SVG, with one unit of margin) */
const cell = (p: Page, x: number, y: number) =>
  p.evaluate(
    ({ x, y }) => {
      const svg = document.querySelector('.gmboard') as SVGSVGElement
      const box = svg.getBoundingClientRect()
      const u = box.width / 16
      return { x: box.left + u * (x + 1), y: box.top + u * (y + 1) }
    },
    { x, y },
  )
const myTurn = async (p: Page) => {
  for (let i = 0; i < 40; i++) {
    if (/Your turn/.test(await p.$eval('.plline', (e) => e.textContent || '').catch(() => ''))) return true
    await sleep(250)
  }
  return false
}

{
  // practice vs the bot, with a mouse
  const p = await page()
  await p.goto('http://localhost:5200/gomoku/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.gmboard')
  ok(await myTurn(p), 'practice: it becomes my turn')
  const c = await cell(p, 7, 7)
  await p.mouse.click(c.x, c.y)
  await sleep(1800)
  ok((await stones(p)) >= 2, `practice: my stone is placed and the bot answers (${await stones(p)} stones)`)
  ok(await myTurn(p), 'practice: it is my turn again')
  const t = await p.$eval('.k-title', (e) => e.textContent || '')
  ok(/Practice/.test(t), 'practice: the header says Practice')
  await p.browserContext().close()
}
{
  // touch: tap once to choose, again (or Place) to play
  const p = await page(true)
  await p.goto('http://localhost:5200/gomoku/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.gmboard')
  ok(await myTurn(p), 'touch: my turn')
  const c = await cell(p, 6, 6)
  await p.touchscreen.tap(c.x, c.y)
  await sleep(300)
  ok((await stones(p)) < 2 && !!(await p.$('.gmghost')), 'touch: the first tap only shows where the stone would go')
  ok(!!(await p.$('.gmconfirm .hdbtn.primary')), 'touch: a Place stone button appears')
  await p.click('.gmconfirm .hdbtn.primary')
  await sleep(1800)
  ok((await stones(p)) >= 2, `touch: Place stone plays it and the bot answers (${await stones(p)})`)
  await p.browserContext().close()
}
{
  // a table: two players and a watcher
  const url = await tableUrl('gomoku', { size: 15 })
  const a = await page(),
    c = await page(),
    w = await page()
  await a.goto(url, { waitUntil: 'domcontentloaded' })
  await a.waitForSelector('.btlobby')
  await c.goto(url, { waitUntil: 'domcontentloaded' })
  await c.waitForSelector('.btlobby')
  await w.goto(url + '?watch=1', { waitUntil: 'domcontentloaded' })
  await w.waitForSelector('.btlobby')
  await sleep(700)
  ok((await a.$$eval('.btlobby li', (e) => e.length)) === 2, 'table: two seats')
  const startBtn = (p: Page) => p.evaluate(() => !!Array.from(document.querySelectorAll('button')).find((e) => /Start game/.test(e.textContent || '')))
  ok((await startBtn(a)) && !(await startBtn(c)), 'table: only the host sees Start')
  await a.evaluate(() => {
    ;(Array.from(document.querySelectorAll('button')).find((e) => /Start game/.test(e.textContent || '')) as HTMLElement | undefined)?.click()
  })
  await a.waitForSelector('.gmboard', { timeout: 10000 })
  await c.waitForSelector('.gmboard')
  await w.waitForSelector('.gmboard')
  await sleep(500)
  const first = (await myTurn(a)) ? a : c,
    second = first === a ? c : a
  const pt = await cell(first, 7, 7)
  await first.mouse.click(pt.x, pt.y)
  await sleep(600)
  ok((await stones(second)) === 1 && (await stones(w)) === 1, 'table: the move reaches the opponent and the watcher')
  ok(await myTurn(second), "table: then it is the opponent's turn")
  const wt = await cell(w, 3, 3)
  await w.mouse.click(wt.x, wt.y)
  await sleep(400)
  ok((await stones(second)) === 1, 'table: a watcher cannot place stones')
  // a quick game: the second player scatters stones, the first makes five in a row
  const seq: [number, number][] = [
    [8, 7],
    [9, 7],
    [10, 7],
    [11, 7],
  ]
  const far: [number, number][] = [
    [0, 0],
    [2, 0],
    [4, 0],
    [6, 0],
  ]
  for (let i = 0; i < 4; i++) {
    const s = await cell(second, far[i][0], far[i][1])
    await second.mouse.click(s.x, s.y)
    await sleep(450)
    const f = await cell(first, seq[i][0], seq[i][1])
    await first.mouse.click(f.x, f.y)
    await sleep(450)
  }
  await first.waitForSelector('.k-result', { timeout: 8000 }).catch(() => {})
  await sleep(400)
  ok(/wins/.test(await first.$eval('.k-result', (e) => e.textContent || '').catch(() => '')), 'table: five in a row ends the game with a winner')
  ok(!!(await second.$('.k-result')) && !!(await w.$('.k-result')), 'table: everyone sees the result')
  ok((await first.$$('.gmwin')).length >= 5, 'table: the winning line is highlighted')
  for (const x of [a, c, w]) await x.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
