import puppeteer from 'puppeteer-core'

/** Plays a solo game (fast) to the end and saves screenshots of the hand result, the game-over podium and the hand review. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const click = (p: any, s: string) => p.evaluate((x: string) => (document.querySelector(x) as HTMLElement | null)?.click(), s)
for (const [w, h, tag] of [
  [1280, 720, 'd'],
  [844, 390, 'p'],
] as const) {
  const p = await b.newPage()
  await p.setViewport({ width: w, height: h, hasTouch: tag === 'p', isMobile: tag === 'p' })
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('kiiro-lang', 'en')
  })
  await p.goto(`http://localhost:5199/?solo=1&rule=${process.env.RULE ?? 'riichi'}&speed=0.02`, { waitUntil: 'networkidle0' })
  let shotResult = false
  for (let i = 0; i < 6000; i++) {
    if (await p.$('.podium')) break
    if ((await p.$('.overlay .modal .winbanner')) && !shotResult) {
      await sleep(300)
      await p.screenshot({ path: `/tmp/o-${tag}-result.png` })
      shotResult = true
    }
    if (await p.$('.overlay .btn.gold:not([disabled])')) await click(p, '.overlay .btn.gold:not([disabled])')
    else if (await p.$('.cbtn.ron')) await click(p, '.cbtn.ron')
    else if (await p.$('.cbtn.pass')) await click(p, '.cbtn.pass')
    else {
      const t = await p.$$('.handrow .tile.clickable')
      if (t.length) {
        await t[t.length - 1].click().catch(() => {})
        await sleep(20)
        await click(p, '.handrow .tile.sel')
      }
    }
    await sleep(30)
  }
  await sleep(300)
  await p.screenshot({ path: `/tmp/o-${tag}-over.png` })
  await p.evaluate(() => {
    for (const x of [...document.querySelectorAll('.modal .btn')] as HTMLElement[])
      if (/review|回顧|振り返/i.test(x.textContent ?? '')) {
        x.click()
        break
      }
  })
  await sleep(500)
  await p.screenshot({ path: `/tmp/o-${tag}-review.png` })
  await p.close()
}
await b.close()
console.log('shots saved')
