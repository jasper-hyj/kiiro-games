import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/generic/chess-ui-test.ts   (vite :5200) Chess in the browser against the computer: pick a piece, see its moves, move, get an answer, resign; mouse and touch.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 240000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const touch of [false, true]) {
  const tag = touch ? 'touch' : 'mouse'
  const p: Page = await (await b.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1100, height: 900 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('PAGEERROR', (e as Error).message)
  })
  await p.goto('http://localhost:5200/chess/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.chboard')
  const sq = (n: string) => `.chsq[aria-label^="${n}"]`
  const tap = async (sel: string) => {
    if (touch) {
      const h = await p.$(sel)
      const bx = await h!.boundingBox()
      await p.touchscreen.tap(bx!.x + bx!.width / 2, bx!.y + bx!.height / 2)
    } else await p.click(sel)
  }
  const myTurn = async () => {
    for (let i = 0; i < 60; i++) {
      if (
        /Your turn/.test(await p.$eval('.plline', (e) => e.textContent || '').catch(() => '')) &&
        !(await p.$eval('.chboard .chsq', (e) => (e as HTMLButtonElement).disabled))
      )
        return true
      await sleep(250)
    }
    return false
  }
  ok(await myTurn(), `${tag}: it becomes my turn (white or black)`)
  const white = /White/.test(await p.$eval('.gmchip', (e) => e.textContent || ''))
  // pick a piece that can move: a pawn in front of the king (e2 for white, e7 for black)
  const from = white ? 'e2' : 'e7',
    to = white ? 'e4' : 'e5'
  await tap(sq(from))
  await sleep(200)
  const targets = await p.$$eval('.chsq.tgt', (e) => e.length)
  ok(targets === 2, `${tag}: choosing a pawn shows its two moves (${targets})`)
  await tap(sq(to))
  await sleep(600)
  ok(/[♟]/.test(await p.$eval(sq(to), (e) => e.textContent || '')), `${tag}: the pawn moved to ${to}`)
  ok(await myTurn(), `${tag}: the computer answered and it is my turn again`)
  ok((await p.$$eval('.chmoves span', (e) => e.length)) >= 1, `${tag}: the move list is filled`)
  // an illegal target does nothing
  await tap(sq(white ? 'a1' : 'a8'))
  await sleep(200)
  ok((await p.$$eval('.chsq.tgt, .chsq.cap', (e) => e.length)) === 0, `${tag}: a piece with no moves shows nothing`)
  // resign
  await p.evaluate(() => {
    ;(Array.from(document.querySelectorAll('.chfoot button')).find((e) => /Resign/.test(e.textContent || '')) as HTMLElement).click()
  })
  await sleep(300)
  ok(!!(await p.$('.acbox')), `${tag}: Resign asks first`)
  await p.evaluate(() => {
    ;(Array.from(document.querySelectorAll('.acbox button')).find((e) => /Yes, resign/.test(e.textContent || '')) as HTMLElement).click()
  })
  await sleep(600)
  ok(/wins/.test(await p.$eval('.k-result', (e) => e.textContent || '').catch(() => '')), `${tag}: resigning ends the game with the computer as winner`)
  await p.screenshot({ path: `${process.env.OUT ?? '.'}/chess-${touch ? 'phone' : 'desk'}.png` })
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
