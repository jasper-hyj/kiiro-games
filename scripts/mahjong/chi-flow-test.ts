import puppeteer from 'puppeteer-core'

/** Plays solo games and, every time the human can chi, clicks it and records what the board shows afterwards. */
const BASE = process.env.BASE ?? 'http://localhost:5199'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1280, height: 720 })
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('kiiro-lang', 'en')
})
await p.goto(`${BASE}/?solo=1&rule=${process.env.RULE ?? 'taiwan'}&speed=0.05`, { waitUntil: 'networkidle0' })
let n = 0
const mine = () =>
  p.evaluate(() => ({
    melds: [...document.querySelectorAll('.mymelds .meld')].map(
      (m) => [...m.querySelectorAll('.tile')].map((t) => (t as HTMLElement).dataset.kind).join(',') + ' sw=' + m.querySelectorAll('.sw').length,
    ),
    hand: [...document.querySelectorAll('.handrow .tile')].length,
    buttons: [...document.querySelectorAll('.cbtn')].map((x) => (x.textContent ?? '').trim()),
  }))
for (let i = 0; i < 1500 && n < 4; i++) {
  const chi = await p.evaluate(
    () => ([...document.querySelectorAll('.cbtn.call')] as HTMLElement[]).filter((x) => /chi|吃/i.test(x.title + x.textContent)).length,
  )
  if (chi) {
    console.log('before', JSON.stringify(await mine()))
    await p.screenshot({ path: `/tmp/chi-before-${n}.png` })
    await p.evaluate(() => ([...document.querySelectorAll('.cbtn.call')] as HTMLElement[]).filter((x) => /chi|吃/i.test(x.title + x.textContent))[0].click())
    await sleep(700)
    console.log('after ', JSON.stringify(await mine()))
    await p.screenshot({ path: `/tmp/chi-after-${n}.png` })
    n++
  } else if (await p.$('.cbtn.ron')) await p.evaluate(() => (document.querySelector('.cbtn.ron') as HTMLElement).click())
  else if (await p.$('.cbtn.pass')) await p.evaluate(() => (document.querySelector('.cbtn.pass') as HTMLElement).click())
  else {
    const t = await p.$$('.handrow .tile.clickable')
    if (t.length) {
      await t[t.length - 1].click().catch(() => {})
      await sleep(30)
      await p.evaluate(() => (document.querySelector('.handrow .tile.sel') as HTMLElement | null)?.click())
    }
  }
  await sleep(40)
}
await b.close()
console.log(n, 'chi calls observed')
