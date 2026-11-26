import puppeteer from 'puppeteer-core'

/** On a touch screen the first tap on Chi / Pon / Kan arms it (its tiles light up, nothing is sent); the second tap confirms. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 844, height: 390, hasTouch: true, isMobile: true })
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('kiiro-lang', 'en')
  ;(window as any).__name = (f: unknown) => f
})
await p.goto('http://localhost:5200/?solo=1&rule=taiwan&speed=0.5', { waitUntil: 'networkidle0' })
let fails = 0,
  done = 0
const click = (s: string) => p.evaluate((x: string) => (document.querySelector(x) as HTMLElement | null)?.click(), s)
for (let i = 0; i < 4000 && done < 3; i++) {
  const btn = await p.$('.actionpop .cbtn.call')
  if (btn) {
    const label = await btn.evaluate((e) => (e as HTMLElement).innerText.split(/\s+/).join(' ').trim())
    await btn.tap()
    await sleep(250)
    const armed = await p.evaluate(() => ({
      lit: document.querySelectorAll('.handrow .tile.callhl').length,
      armed: !!document.querySelector('.cbtn[data-armed="1"]'),
      stillThere: !!document.querySelector('.actionpop .cbtn.call'),
    }))
    const ok1 = armed.lit >= 1 && armed.armed && armed.stillThere
    await btn.tap()
    await sleep(400)
    const gone = await p.evaluate(() => !document.querySelector('.actionpop .cbtn.call[data-armed="1"]'))
    const ok = ok1 && gone
    if (!ok) fails++
    done++
    console.log(ok ? 'ok  ' : 'FAIL', `"${label}": first tap lit ${armed.lit} tiles and waited (${ok1}); second tap confirmed (${gone})`)
  } else if (await p.$('.cbtn.ron')) await click('.cbtn.ron')
  else if (await p.$('.cbtn.pass')) await click('.cbtn.pass')
  else if (await p.$('.overlay .btn.gold:not([disabled])')) await click('.overlay .btn.gold:not([disabled])')
  else {
    const t = await p.$$('.handrow .tile.clickable')
    if (t.length) {
      await t[t.length - 1].click().catch(() => {})
      await sleep(20)
      await click('.handrow .tile.sel')
    }
  }
  await sleep(40)
}
console.log(done ? `${done} call buttons tapped` : 'no call buttons appeared')
await b.close()
process.exit(fails || !done ? 1 : 0)
