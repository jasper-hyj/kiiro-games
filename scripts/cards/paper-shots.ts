import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/paper-shots.ts <outDir> [port]   Screenshots of the main pages (desktop and phone) to look at the overall design.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const PAGES: [string, string][] = [['hub', '/'], ['room', '/room'], ['holdem', '/holdem/practice'], ['blackjack', '/blackjack/practice'], ['bigtwo', '/bigtwo/practice'], ['mahjong', '/mahjong/practice'], ['gomoku', '/gomoku/practice'], ['chess', '/chess/practice'], ['xiangqi', '/xiangqi/practice'], ['crazyeights', '/crazyeights/practice'], ['yahtzee', '/yahtzee/practice'], ['liarsdice', '/liarsdice/practice'], ['doudizhu', '/doudizhu/practice'], ['bridge', '/bridge/practice'], ['hearts', '/hearts/practice'], ['spades', '/spades/practice'], ['go', '/go/practice'], ['checkers', '/checkers/practice'], ['reversi', '/reversi/practice'], ['chinesecheckers', '/chinesecheckers/practice'], ['admin', '/admin']]
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const only = process.argv[4]?.split(',')
for (const [name, path] of PAGES) {
  if (only && !only.includes(name)) continue
  for (const [w, h, tag] of [[1280, 820, 'desk'], [390, 844, 'phone']] as const) {
    const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
    await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
    await p.goto(`http://localhost:${port}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await new Promise((r) => setTimeout(r, 2500))
    await p.screenshot({ path: `${out}/${name}-${tag}.png` })
    await p.browserContext().close()
  }
}
await b.close()
