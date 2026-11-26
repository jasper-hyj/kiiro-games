import puppeteer from 'puppeteer-core'

/** Plays solo games fast and checks that every exposed chi/pon/kan is drawn with a sideways (called) tile. */
const BASE = process.env.BASE ?? 'http://localhost:5200'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0,
  seen = 0
for (const rule of (process.env.RULES ?? 'taiwan,hk,riichi').split(',')) {
  const p = await b.newPage()
  await p.setViewport({ width: 1280, height: 720 })
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('kiiro-lang', 'en')
  })
  await p.goto(`${BASE}/?solo=1&rule=${rule}&speed=0.02`, { waitUntil: 'networkidle0' })
  const shot = new Set<string>()
  for (let i = 0; i < 900; i++) {
    const info = await p.evaluate(() =>
      [...document.querySelectorAll('.meld')].map((m) => ({
        tiles: m.querySelectorAll('.tile').length,
        kinds: [...m.querySelectorAll('.tile')].map((x) => +((x as HTMLElement).dataset.kind ?? -1)),
        inModal: !!m.closest('.modal'),
        side: m.querySelectorAll('.sw').length,
        backs: m.querySelectorAll('.tile.back').length,
        html: (m.parentElement as HTMLElement).outerHTML.slice(0, 3000),
      })),
    )
    for (const m of info) {
      seen++
      const ks = [...m.kinds].sort((a, b) => a - b)
      const seq = ks.length === 3 && ks[1] === ks[0] + 1 && ks[2] === ks[1] + 1
      const same = new Set(ks).size === 1
      const wrong = m.backs ? false : (m.side === 0 && !m.inModal) || (m.tiles === 3 && !seq && !same) || (m.tiles === 4 && !same)
      if (wrong && !shot.has(m.html)) {
        shot.add(m.html)
        bad++
        console.log(
          'BAD MELD',
          rule,
          'tiles',
          m.tiles,
          'kinds',
          m.kinds,
          'sw',
          m.side,
          'backs',
          m.backs,
          'html',
          m.html.replace(/<svg.*?<\/svg>/g, '<svg/>').slice(0, 700),
        )
      }
    }
    if (await p.$('.cbtn.ron')) await p.evaluate(() => (document.querySelector('.cbtn.ron') as HTMLElement).click())
    else if (await p.$('.cbtn.call')) await p.evaluate(() => (document.querySelector('.cbtn.call') as HTMLElement).click())
    else if (await p.$('.cbtn.pass')) await p.evaluate(() => (document.querySelector('.cbtn.pass') as HTMLElement).click())
    else {
      const t = await p.$$('.handrow .tile.clickable')
      if (t.length) {
        await t[t.length - 1].click().catch(() => {})
        await sleep(30)
        await p.evaluate(() => (document.querySelector('.handrow .tile.sel') as HTMLElement | null)?.click())
      }
    }
    if (await p.$('.overlay .modal')) {
      await p.screenshot({ path: `/tmp/chi-${rule}.png` })
      break
    }
    await sleep(40)
  }
  await p.close()
}
await b.close()
console.log(`${seen} meld snapshots, ${bad} without a sideways tile`)
process.exit(bad ? 1 : 0)
