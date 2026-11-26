import puppeteer from 'puppeteer-core'

/** Plays a solo game fast until a hand is won and saves screenshots of the win announcement and the result card (desktop + phone). */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const click = (p: any, s: string) => p.evaluate((x: string) => (document.querySelector(x) as HTMLElement | null)?.click(), s)
for (const [w, h, tag] of [
  [1280, 720, 'd'],
  [844, 390, 'p'],
  [390, 844, 'v'],
] as const) {
  const p = await b.newPage()
  await p.setViewport({ width: w, height: h, hasTouch: tag !== 'd', isMobile: tag !== 'd' })
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('kiiro-lang', 'en')
    ;(window as any).__name = (f: unknown) => f
  })
  await p.goto(`http://localhost:5199/?solo=1&rule=${process.env.RULE ?? 'riichi'}&speed=0.15`, { waitUntil: 'networkidle0' })
  let announced = false,
    resulted = false
  for (let i = 0; i < 6000 && !resulted; i++) {
    if (!announced && (await p.$('.winannounce'))) {
      await sleep(700)
      await p.screenshot({ path: `/tmp/win-${tag}-announce.png` })
      announced = true
    }
    if (await p.$('.overlay .modal .winbanner:not(.draw)')) {
      await sleep(500)
      await p.screenshot({ path: `/tmp/win-${tag}-result.png` })
      resulted = true
      break
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
  console.log(tag, 'announce shot:', announced, 'result shot:', resulted)
  await p.close()
}
await b.close()
