import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/mahjong/tile-style-shot.ts <outDir>   (vite on :5200) - white dragon per style, plus the in-game menu control
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, tag] of [[1280, 720, 'desk'], [844, 390, 'phone'], [1024, 768, 'tab']] as const) {
  for (const rule of ['taiwan', 'riichi']) {
    const p = await b.newPage()
    await p.setViewport({ width: w, height: h, hasTouch: tag !== 'desk', isMobile: tag !== 'desk' })
    await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en') })
    await p.goto(`http://localhost:5200/mahjong?stress=full&players=4&rule=${rule}`, { waitUntil: 'networkidle0' }); await sleep(400)
    const dragons = await p.$$eval('.tile .white-dragon', (e) => e.length)
    await p.screenshot({ path: `${out}/tiles-${rule}-${tag}.png` })
    await p.evaluate(() => (document.querySelector('.dock summary') as HTMLElement).click()); await sleep(400)
    await p.screenshot({ path: `${out}/tilemenu-${rule}-${tag}.png` })
    console.log(tag, rule, 'white dragons on screen:', dragons)
    await p.close()
  }
}
await b.close()
