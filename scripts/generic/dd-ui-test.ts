import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/generic/dd-ui-test.ts   (vite :5200) Dou Dizhu in the browser against two bots: bid, then play whole games with taps (select cards, Play, Pass, Hint); mouse and touch.
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
  const tag = touch ? 'touch' : 'mouse'
  const p: Page = await (await b.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1100, height: 900 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('PAGEERROR', (e as Error).message)
  })
  await p.goto('http://localhost:5200/doudizhu/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.dd')
  const tap = async (sel: string) => {
    if (touch) {
      const h = await p.$(sel)
      await h!.evaluate((e) => e.scrollIntoView({ block: 'center' }))
      await sleep(100)
      const bx = await h!.boundingBox()
      await p.touchscreen.tap(bx!.x + bx!.width / 2, bx!.y + bx!.height / 2)
    } else await p.click(sel)
  }
  const btn = (re: RegExp) =>
    p.evaluateHandle(
      (src) =>
        Array.from(document.querySelectorAll('.ddbid button, .ddbtns button')).find(
          (e) => new RegExp(src).test(e.textContent || '') && !(e as HTMLButtonElement).disabled,
        ) ?? null,
      re.source,
    )
  let plays = 0,
    passes = 0,
    bids = 0,
    done = false
  for (let i = 0; i < 900 && !done; i++) {
    if (await p.$('.k-result')) {
      done = true
      break
    }
    const line = await p.$eval('.plline', (e) => e.textContent || '').catch(() => '')
    if (/Your turn/.test(line)) {
      if (await p.$('.ddbid')) {
        const h = (await btn(/point/)).asElement()
        if (h) {
          await (touch ? tap('.ddbid button:not([disabled])') : (h as any).click())
          bids++
        }
        await sleep(400)
        continue
      }
      const hint = (await btn(/Hint/)).asElement()
      if (hint) {
        await (touch ? tap('.ddbtns .hdbtn:nth-child(3)') : (hint as any).click())
        await sleep(200)
      }
      const play = (await btn(/Play/)).asElement()
      if (play) {
        await (touch ? tap('.ddbtns .hdbtn.primary') : (play as any).click())
        plays++
        await sleep(350)
        continue
      }
      const pass = (await btn(/^Pass/)).asElement()
      if (pass) {
        await (pass as any).click()
        passes++
        await sleep(350)
        continue
      }
    }
    await sleep(300)
  }
  ok(bids >= 1, `${tag}: bidding worked (${bids} bid)`)
  ok(done || plays >= 5, `${tag}: cards were played with Hint + Play (${plays} plays, ${passes} passes)`)
  if (done) ok(/wins/.test(await p.$eval('.k-result', (e) => e.textContent || '')), `${tag}: the round ends with a result`)
  await p.screenshot({ path: `${process.env.OUT ?? '.'}/dd-${touch ? 'phone' : 'desk'}.png` })
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
