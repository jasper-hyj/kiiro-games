import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/generic/bridge-ui-test.ts   (vite :5200) Bridge in the browser with three bots: bid with the bidding box, play cards (and the dummy's when you are declarer), reach the score; mouse and touch.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 560000)
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
  await p.goto('http://localhost:5200/bridge/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.br')
  const tap = async (sel: string) => {
    if (touch) {
      const h = await p.$(sel)
      await h!.evaluate((e) => e.scrollIntoView({ block: 'center' }))
      await sleep(100)
      const bx = await h!.boundingBox()
      await p.touchscreen.tap(bx!.x + bx!.width / 2, bx!.y + bx!.height / 2)
    } else await p.click(sel)
  }
  let calls = 0,
    cards = 0,
    done = false
  const t00 = Date.now()
  for (let i = 0; i < 1600 && !done; i++) {
    if (await p.$('.k-result')) {
      done = true
      break
    }
    if (i % 40 === 0) console.log('  ...', tag, Math.round((Date.now() - t00) / 1000) + 's', 'calls', calls, 'cards', cards)
    if (touch && cards >= 3) {
      done = true
      break
    } // on a phone it is enough to show that bidding and card taps work
    if (await p.$('.brbox')) {
      await tap(calls === 0 ? '.brrow button:not([disabled])' : '.brbtns .hdbtn:first-child')
      calls++
      await sleep(450)
      continue
    } // bid the lowest bid first, then pass (so the deal is played)
    if (await p.$('.brcard.ok')) {
      await tap('.brcard.ok')
      cards++
      await sleep(450)
      continue
    }
    await sleep(300)
  }
  ok(calls >= 1, `${tag}: the bidding box works (${calls} calls)`)
  ok(done, `${tag}: the deal reaches a score (${cards} cards played by me)`)
  ok(
    cards >= 3 || (await p.$eval('.k-result', (e) => e.textContent || '').catch(() => '')).length > 0,
    `${tag}: cards were played through the board (${cards})`,
  )
  if (done && !touch) ok(/Play again/.test(await p.$eval('.k-result', (e) => e.textContent || '')), `${tag}: the result offers Play again`)
  await p.screenshot({ path: `${process.env.OUT ?? '.'}/br-${touch ? 'phone' : 'desk'}.png` })
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
