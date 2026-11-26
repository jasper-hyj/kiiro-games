import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/generic/yahtzee-ui-test.ts   (vite :5200) Yahtzee in the browser against a bot: roll, keep dice, score boxes, play all 13 rounds, mouse and touch.
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
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1100, height: 900 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('PAGEERROR', (e as Error).message)
  })
  await p.goto('http://localhost:5200/yahtzee/practice', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.yzdice')
  const tap = async (sel: string) => {
    if (touch) {
      const h = await p.$(sel)
      await h!.evaluate((e) => e.scrollIntoView({ block: 'center' }))
      await sleep(120)
      const bx = await h!.boundingBox()
      await p.touchscreen.tap(bx!.x + bx!.width / 2, bx!.y + bx!.height / 2)
    } else await p.click(sel)
  }
  let scored = 0,
    held = 0,
    done = false
  for (let i = 0; i < 600 && !done; i++) {
    if (await p.$('.k-result')) {
      done = true
      break
    }
    const line = await p.$eval('.plline', (e) => e.textContent || '').catch(() => '')
    if (/Your turn/.test(line)) {
      const rolls = await p.$eval('.yzctl .muted', (e) => e.textContent || '').catch(() => '')
      if (/Roll the dice to start/.test(rolls)) {
        await tap('.yzctl .hdbtn.primary')
        await sleep(250)
        continue
      }
      if (/rolls left/.test(rolls) && /2 rolls left/.test(rolls)) {
        await tap('.yzdie.live')
        held++
        await tap('.yzctl .hdbtn.primary')
        await sleep(250)
        continue
      }
      if (await p.$('.yzsheet td.opt button')) {
        await tap('.yzsheet td.opt button')
        scored++
        await sleep(300)
        continue
      }
      if (/rolls left/.test(rolls)) {
        await tap('.yzctl .hdbtn.primary')
        await sleep(250)
        continue
      }
    }
    await sleep(250)
  }
  ok(done, `${touch ? 'touch' : 'mouse'}: all 13 rounds were played (${scored} boxes scored, ${held} dice kept)`)
  if (done) {
    ok(scored === 13, `${touch ? 'touch' : 'mouse'}: 13 boxes were filled (${scored})`)
    ok(/Play again/.test(await p.$eval('.k-result', (e) => e.textContent || '')), `${touch ? 'touch' : 'mouse'}: the result offers Play again`)
    await p.screenshot({ path: `${process.env.OUT ?? '.'}/yz-${touch ? 'phone' : 'desk'}.png` })
  }
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
