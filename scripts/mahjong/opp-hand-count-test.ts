import puppeteer from 'puppeteer-core'

/** An opponent never shows more face-down tiles than they can hold: handSize - 3 x melds, plus one only right after drawing. */
const BASE = process.env.BASE ?? 'http://localhost:5200'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0,
  checked = 0
const SIZE: Record<string, number> = { taiwan: 16, hk: 13, riichi: 13, mcr: 13 }
for (const rule of (process.env.RULES ?? 'taiwan,hk,riichi').split(',')) {
  const p = await b.newPage()
  await p.setViewport({ width: 1280, height: 720 })
  await p.goto(`${BASE}/?solo=1&rule=${rule}&speed=0.02`, { waitUntil: 'networkidle0' })
  const seen = new Set<string>()
  for (let i = 0; i < 700; i++) {
    const seats = await p.evaluate(() =>
      [...document.querySelectorAll('.seat.top, .seat.left, .seat.right')].map((s) => ({
        backs: s.querySelectorAll('.backs .tile.back').length,
        melds: s.querySelectorAll('.melds .meld').length,
        kans: [...s.querySelectorAll('.melds .meld')].filter((m) => m.querySelectorAll('.tile').length === 4).length,
        turn: !!s.querySelector('.chip.turn'),
      })),
    )
    for (const s of seats) {
      checked++
      const max = SIZE[rule] - 3 * s.melds + 1
      const key = JSON.stringify(s)
      if (s.backs > max && !seen.has(key)) {
        seen.add(key)
        bad++
        console.log('TOO MANY BACKS', rule, JSON.stringify(s), 'max', max)
      }
    }
    if (await p.$('.cbtn.ron')) await p.evaluate(() => (document.querySelector('.cbtn.ron') as HTMLElement).click())
    else if (await p.$('.cbtn.pass')) await p.evaluate(() => (document.querySelector('.cbtn.pass') as HTMLElement).click())
    else {
      const t = await p.$$('.handrow .tile.clickable')
      if (t.length) {
        await t[t.length - 1].click().catch(() => {})
        await sleep(30)
        await p.evaluate(() => (document.querySelector('.handrow .tile.sel') as HTMLElement | null)?.click())
      }
    }
    if (await p.$('.overlay .modal')) break
    await sleep(30)
  }
  await p.close()
}
await b.close()
console.log(`${checked} opponent hands checked, ${bad} showing too many tiles`)
process.exit(bad ? 1 : 0)
