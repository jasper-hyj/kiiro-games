import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/generic/xq-ui-test.ts   (vite :5200) Xiangqi in the browser against the computer: pick a piece, see its moves, move, get an answer, resign; mouse and touch.
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 240000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const touch of [false, true]) {
  const tag = touch ? 'touch' : 'mouse'
  const p: Page = await (await b.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1100, height: 900 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => { fails++; console.log('PAGEERROR', (e as Error).message) })
  await p.goto('http://localhost:5200/xiangqi/practice', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.xqboard')
  const myTurn = async () => { for (let i = 0; i < 60; i++) { if (/Your turn/.test(await p.$eval('.plline', (e) => e.textContent || '').catch(() => ''))) return true; await sleep(250) } return false }
  ok(await myTurn(), `${tag}: it becomes my turn (red or black)`)
  const red = /Red/.test(await p.$eval('.gmchip', (e) => e.textContent || ''))
  /** the screen position of the point (file f, rank r) */
  const at = (f: number, r: number) => p.evaluate(({ f, r, flip }) => { const svg = document.querySelector('.xqboard') as SVGSVGElement; const box = svg.getBoundingClientRect(); const u = box.width / 9.5; const X = 0.75 + (flip ? 8 - f : f), Y = 0.75 + (flip ? r : 9 - r); return { x: box.left + X * u, y: box.top + Y * u } }, { f, r, flip: !red })
  const tap = async (f: number, r: number) => { const c = await at(f, r); if (touch) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y) }
  const pieces = () => p.$$eval('.xqp', (e) => e.length)
  // a soldier on file c: one step forward
  const [fromR, toR] = red ? [3, 4] : [6, 5]
  await tap(2, fromR); await sleep(250)
  const dots = await p.$$eval('.xqtgt', (e) => e.length)
  ok(dots === 1, `${tag}: choosing a soldier shows its one forward step (${dots})`)
  await tap(2, toR); await sleep(700)
  ok(await myTurn(), `${tag}: the computer answered and it is my turn again`)
  ok((await p.$$eval('.chmoves span', (e) => e.length)) >= 1 && (await pieces()) >= 30, `${tag}: the move list is filled and the pieces are on the board (${await pieces()})`)
  // a cannon can jump to capture the far soldier only with a screen: choosing a piece that cannot move shows nothing
  await tap(3, 4); await sleep(200)
  ok((await p.$$eval('.xqtgt, .xqcap', (e) => e.length)) === 0, `${tag}: tapping an empty point shows nothing`)
  await p.evaluate(() => { (Array.from(document.querySelectorAll('.chfoot button')).find((e) => /Resign/.test(e.textContent || '')) as HTMLElement).click() }); await sleep(300)
  await p.evaluate(() => { (Array.from(document.querySelectorAll('.acbox button')).find((e) => /Yes, resign/.test(e.textContent || '')) as HTMLElement).click() }); await sleep(600)
  ok(/wins/.test(await p.$eval('.k-result', (e) => e.textContent || '').catch(() => '')), `${tag}: resigning ends the game`)
  await p.screenshot({ path: `${process.env.OUT ?? '.'}/xq-${touch ? 'phone' : 'desk'}.png` })
  await p.browserContext().close()
}
await b.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
