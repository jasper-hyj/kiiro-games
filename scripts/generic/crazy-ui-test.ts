import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/generic/crazy-ui-test.ts   (vite :5200) Crazy Eights in the browser against three bots: play whole games with taps, draw and pass when stuck, choose a suit for an 8.
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
  const p: Page = await (await b.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1100, height: 850 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('PAGEERROR', (e as Error).message)
  })
  await p.goto('http://localhost:5200/crazyeights/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.c8hand')
  let moves = 0,
    draws = 0,
    passes = 0,
    eights = 0,
    done = false
  const tap = async (sel: string) => {
    if (touch) {
      const h = await p.$(sel)
      const bx = await h!.boundingBox()
      await p.touchscreen.tap(bx!.x + bx!.width / 2, bx!.y + bx!.height / 2)
    } else await p.click(sel)
  }
  for (let i = 0; i < 400 && !done; i++) {
    if (await p.$('.k-result')) {
      done = true
      break
    }
    const line = await p.$eval('.plline', (e) => e.textContent || '').catch(() => '')
    if (/Your turn/.test(line)) {
      if (await p.$('.c8suits')) {
        await tap('.c8suits button')
        eights++
        await sleep(250)
        continue
      }
      const card = await p.$('.c8card.ok')
      if (card) {
        const label = await p.evaluate((e) => e.getAttribute('class') || '', card)
        void label
        await tap('.c8card.ok')
        moves++
        await sleep(350)
        continue
      }
      if (await p.$('.c8pile.live')) {
        await tap('.c8pile.live')
        draws++
        await sleep(350)
        continue
      }
      const pass = await p.evaluateHandle(() => Array.from(document.querySelectorAll('.c8msg button')).find((e) => /Pass/.test(e.textContent || '')) ?? null)
      if (pass.asElement()) {
        await (pass.asElement() as any).click()
        passes++
        await sleep(350)
        continue
      }
    }
    await sleep(300)
  }
  ok(done, `${touch ? 'touch' : 'mouse'}: a whole game was played to a result (${moves} plays, ${draws} draws, ${passes} passes, ${eights} eights)`)
  if (done) {
    const txt = await p.$eval('.k-result', (e) => e.textContent || '')
    ok(/wins/.test(txt) && /Play again/.test(txt), `${touch ? 'touch' : 'mouse'}: the result names a winner and offers Play again`)
    await p.screenshot({ path: `${process.env.OUT ?? '.'}/c8-${touch ? 'phone' : 'desk'}.png` })
    await p.evaluate(() => {
      ;(Array.from(document.querySelectorAll('.k-result button')).find((e) => /Play again/.test(e.textContent || '')) as HTMLElement | undefined)?.click()
    })
    await sleep(900)
    ok(!!(await p.$('.c8hand')) && !(await p.$('.k-result')), `${touch ? 'touch' : 'mouse'}: Play again deals a new game`)
  }
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
