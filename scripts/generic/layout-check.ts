import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/generic/layout-check.ts   (vite :5200) Every turn-based game's practice screen at phone, landscape-phone and desktop sizes: no sideways scrolling, nothing wider than the screen.
const GAMES = ['gomoku', 'crazyeights', 'yahtzee', 'liarsdice', 'chess', 'xiangqi', 'doudizhu', 'bridge']
const SIZES: [number, number][] = [[320, 568], [390, 844], [667, 375], [820, 1180], [1280, 720]]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let problems = 0
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const game of GAMES) {
  for (const [w, h] of SIZES) {
    const p = await (await b.createBrowserContext()).newPage()
    await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
    await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
    const errors: string[] = []; p.on('pageerror', (e: unknown) => errors.push((e as Error).message))
    await p.goto(`http://localhost:5200/${game}/practice`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.play', { timeout: 15000 }).catch(() => {})
    await sleep(1800)
    const r = (await p.evaluate(`(() => {
      const out = []
      const doc = document.scrollingElement || document.documentElement
      const root = document.querySelector('.kg.play') || document.body
      const sw = Math.max(doc.scrollWidth, root.scrollWidth), iw = innerWidth
      if (sw > iw + 1) out.push('sideways scroll: page is ' + sw + 'px wide on a ' + iw + 'px screen')
      for (const e of document.querySelectorAll('.play button, .play .k-result, .play svg, .play table')) {
        const q = e.getBoundingClientRect()
        if (q.width > 0 && (q.right > iw + 2 || q.left < -2) && !e.closest('.yzsheet, .ddhand, .brhand, .c8hand, .chmoves')) out.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName).toString().slice(0, 30) + ' goes outside the screen (' + Math.round(q.left) + ' to ' + Math.round(q.right) + ')')
      }
      return out.slice(0, 4)
    })()`)) as string[]
    for (const x of r) { problems++; console.log(`  ${game} ${w}x${h}: ${x}`) }
    for (const x of errors.slice(0, 1)) { problems++; console.log(`  ${game} ${w}x${h}: page error ${x}`) }
    await p.browserContext().close()
  }
  console.log(`checked ${game}`)
}
await b.close(); console.log(problems ? `${problems} things to look at` : 'no layout problems'); process.exit(0)
