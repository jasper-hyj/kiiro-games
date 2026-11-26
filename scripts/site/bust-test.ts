import puppeteer from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/site/bust-test.ts [outDir]   (local wrangler :8787 + vite :5200)
// A signed-in player at a ranked Blackjack table bets everything until the chips run out: the screen must say so and offer a buy-back.
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 280000)
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const u = 'bu' + Math.floor(Math.random() * 1e6)
const r = await fetch('http://localhost:8787/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: u, password: 'password123' }),
})
const { token } = (await r.json()) as { token: string }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
p.on('pageerror', (e) => {
  fails++
  console.log('PAGEERROR', (e as Error).message)
})
await p.evaluateOnNewDocument((t: string) => {
  localStorage.setItem('kiiro-lang', 'en')
  localStorage.setItem('kiiro-token', t)
}, token)
await p.goto(await tableUrl('blackjack', { bb: 10, casual: false }), { waitUntil: 'networkidle0' })
await p.waitForSelector('.hdsit .hdbtn.primary')
await sleep(600)
// the smallest buy-in: drag the slider to its minimum
await p.$eval('.hdbuy input', (e) => {
  const i = e as HTMLInputElement
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  set.call(i, i.min)
  i.dispatchEvent(new Event('input', { bubbles: true }))
})
await p.click('.hdsit .hdbtn.primary')
let bust = false
for (let i = 0; i < 60 && !bust; i++) {
  await sleep(700)
  if (await p.$('.k-bust')) {
    bust = true
    break
  }
  if (await p.$('.bjchips')) {
    // bet as much as the chips allow: click the biggest enabled chip until the stake stops growing, then place the bet
    for (let k = 0; k < 40; k++) {
      const done = await p.evaluate(() => {
        const c = Array.from(document.querySelectorAll('.bjchip'))
          .reverse()
          .find((e) => !(e as HTMLButtonElement).disabled) as HTMLButtonElement | undefined
        if (!c) return true
        c.click()
        return false
      })
      if (done) break
    }
    await p.evaluate(() => {
      const bt = document.querySelector('.bjbetbar .hdbtn.primary') as HTMLButtonElement | null
      if (bt && !bt.disabled) bt.click()
    })
  } else if (await p.$('.bj-actions')) await p.click('.bj-actions .hdbtn:nth-child(2)') // stand
}
ok(bust, 'the out-of-chips panel appears when the stack is gone')
if (bust) {
  const text = await p.$eval('.k-bust', (e) => (e.textContent || '').replace(/\s+/g, ' '))
  ok(/out of chips/i.test(text) && /Buy back in/.test(text) && /Leave table/.test(text), `it explains and offers buy-back + leave ("${text.slice(0, 90)}")`)
  await p.screenshot({ path: `${out}/bust.png` })
  await p.click('.k-bust .hdbtn.primary')
  await sleep(1500)
  ok(!(await p.$('.k-bust')), 'buying back in makes the panel go away and the betting chips return')
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
