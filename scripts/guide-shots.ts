import puppeteer from 'puppeteer-core'

/** Opens the how-to-play guide on a few devices / languages and saves screenshots (also checks nothing overflows the modal). */
const BASE = process.env.BASE ?? 'http://localhost:5199'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0
for (const [w, h, touch, tag] of [[1280, 720, false, 'desk'], [844, 390, true, 'phone'], [768, 1024, true, 'tabp']] as const) {
  for (const lang of ['en', 'zh', 'ja']) {
    const p = await b.newPage()
    await p.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch })
    await p.evaluateOnNewDocument((l) => { try { localStorage.setItem('kiiro-lang', l) } catch { /* ignore */ } }, lang)
    await p.goto(BASE + '/', { waitUntil: 'networkidle0' })
    await sleep(300)
    await p.evaluate(() => { for (const x of [...document.querySelectorAll('.rulesfab')] as HTMLElement[]) if (x.textContent && /🎓/.test(x.textContent)) { x.click(); break } })
    await sleep(400)
    for (const lesson of [0, 3, 6]) {
      await p.evaluate((n) => (document.querySelectorAll('.gstep')[n] as HTMLElement | undefined)?.click(), lesson)
      await sleep(200)
      await p.screenshot({ path: `/tmp/guide-${tag}-${lang}-${lesson}.png` })
      const over = await p.evaluate(() => { const m = document.querySelector('.modal.guide') as HTMLElement | null; return m ? m.scrollWidth - m.clientWidth : -1 })
      if (over > 1) { bad++; console.log('HORIZONTAL OVERFLOW', tag, lang, lesson, over) }
    }
    await p.close()
  }
}
await b.close()
console.log(bad ? `${bad} problems` : 'guide fits on every device')
