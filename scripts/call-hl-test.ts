import puppeteer from 'puppeteer-core'

/** In a real solo game: when Chi / Pon / Kan buttons appear, pointing at one lights the tiles it uses in the hand (2 for chi/pon, 3 for kan) and the discard. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en'); (window as any).__name = (f: unknown) => f })
await p.goto('http://localhost:5199/?solo=1&rule=taiwan&speed=0.5', { waitUntil: 'networkidle0' })
let fails = 0, checked = 0
const click = (s: string) => p.evaluate((x: string) => (document.querySelector(x) as HTMLElement | null)?.click(), s)
for (let i = 0; i < 4000 && checked < 6; i++) {
  const btns = await p.$$('.actionpop .cbtn.call')
  if (btns.length) {
    for (const btn of btns) {
      const label = await btn.evaluate((e) => (e as HTMLElement).innerText.split(/\s+/).join(' ').trim())
      await btn.hover(); await sleep(200)
      const lit = await p.evaluate(() => ({ hand: document.querySelectorAll('.handrow .tile.callhl').length, river: document.querySelectorAll('.pond .tile.callhl').length }))
      const want = /^Kan/.test(label) ? 3 : /^Add/.test(label) ? 1 : 2
      const ok = lit.hand === want
      if (!ok) fails++
      checked++
      console.log(ok ? 'ok  ' : 'FAIL', `"${label}": hand ${lit.hand} (want ${want}), discard ${lit.river}`)
    }
    await p.mouse.move(5, 5)
    await click('.cbtn.pass')
  } else if (await p.$('.cbtn.ron')) await click('.cbtn.ron')
  else if (await p.$('.cbtn.pass')) await click('.cbtn.pass')
  else if (await p.$('.overlay .btn.gold:not([disabled])')) await click('.overlay .btn.gold:not([disabled])')
  else { const t = await p.$$('.handrow .tile.clickable'); if (t.length) { await t[t.length - 1].click().catch(() => {}); await sleep(20); await click('.handrow .tile.sel') } }
  await sleep(40)
}
check: { console.log(checked ? `${checked} call buttons checked` : 'no call buttons appeared') }
await b.close()
process.exit(fails || !checked ? 1 : 0)
