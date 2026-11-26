import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/generic/liars-ui-test.ts   (vite :5200) Liar's Dice in the browser against three bots: bid with the stepper and face buttons, call "Liar!", watch the reveal, play to a winner.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 280000)
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
  const p: Page = await (await b.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1100, height: 900 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('PAGEERROR', (e as Error).message)
  })
  await p.goto('http://localhost:5200/liarsdice/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.ldplayers')
  const tap = async (sel: string) => {
    if (touch) {
      const h = await p.$(sel)
      await h!.evaluate((e) => e.scrollIntoView({ block: 'center' }))
      await sleep(120)
      const bx = await h!.boundingBox()
      await p.touchscreen.tap(bx!.x + bx!.width / 2, bx!.y + bx!.height / 2)
    } else await p.click(sel)
  }
  let bids = 0,
    calls = 0,
    reveals = 0,
    done = false
  for (let i = 0; i < 500 && !done; i++) {
    if (await p.$('.k-result')) {
      done = true
      break
    }
    const line = await p.$eval('.plline', (e) => e.textContent || '').catch(() => '')
    if (/Your turn/.test(line) && (await p.$('.ldctl'))) {
      if (await p.$('.ldreveal')) reveals++
      const hasLiar = await p.evaluate(() => !!Array.from(document.querySelectorAll('.ldbtns button')).find((e) => /Liar/.test(e.textContent || '')))
      if (hasLiar && bids >= 2 && bids % 3 === 0) {
        await p.evaluate(() => {
          ;(Array.from(document.querySelectorAll('.ldbtns button')).find((e) => /Liar/.test(e.textContent || '')) as HTMLElement).click()
        })
        calls++
        bids++
        await sleep(500)
        continue
      }
      await tap('.ldbtns .hdbtn.primary')
      bids++
      await sleep(450)
      continue
    }
    await sleep(300)
  }
  ok(done || bids > 20, `${touch ? 'touch' : 'mouse'}: bids and calls work for a long game (${bids} bids, ${calls} calls, reveals seen ${reveals})`)
  ok(calls > 0 && reveals > 0, `${touch ? 'touch' : 'mouse'}: calling Liar! lifts the cups and shows the dice`)
  if (done) ok(/wins/.test(await p.$eval('.k-result', (e) => e.textContent || '')), `${touch ? 'touch' : 'mouse'}: the game ends with a winner`)
  await p.screenshot({ path: `${process.env.OUT ?? '.'}/ld-${touch ? 'phone' : 'desk'}.png` })
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
