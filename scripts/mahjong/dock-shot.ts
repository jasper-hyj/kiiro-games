import puppeteer from 'puppeteer-core'

/** Opens the in-game menu panel on a few screens and saves screenshots. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, tag] of [
  [1280, 720, 'd'],
  [844, 390, 'p'],
  [1024, 768, 't'],
] as const) {
  const p = await b.newPage()
  await p.setViewport({ width: w, height: h, hasTouch: tag !== 'd', isMobile: tag !== 'd' })
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('kiiro-lang', 'en')
  })
  await p.goto('http://localhost:5199/?stress=full&players=4&rule=riichi', { waitUntil: 'networkidle0' })
  await sleep(300)
  await p.evaluate(() => (document.querySelector('.dock summary') as HTMLElement).click())
  await sleep(400)
  await p.screenshot({ path: `/tmp/dock-${tag}.png` })
  await p.close()
}
await b.close()
