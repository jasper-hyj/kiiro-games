import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/touch-audit.ts <outDir> [port]   Every game's practice screen on small phones: how much of the width the board uses, how
// big the things you tap are, and whether the main controls fit without scrolling. Saves a screenshot of each.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const only = process.argv[4]?.split(',')
const GAMES = ['holdem', 'blackjack', 'bigtwo', 'mahjong', 'gomoku', 'crazyeights', 'yahtzee', 'liarsdice', 'chess', 'xiangqi', 'doudizhu', 'bridge', 'chinesecheckers', 'go', 'hearts', 'spades', 'checkers', 'reversi']
// the board or main play area, and the things a finger has to hit
const BOARD = '.gmboard, .chboard, .xqboard, .ckboard, .rvboard, .ccboard, .tktable, .bttable, .hdfelt, .bjtable, .c8table, .yzdice, .ldbid, .ddtable, .brtable, .board'
const TAPS = '.chsq:not(:disabled), .cksq:not(:disabled), .rvsq.ok, .cclive, .xqcell.live, .gmhit, .btcard, .c8card.ok, .tkcard.ok, .ddcard, .brcard.ok, .yzdie.live, .tile, .hdbtn:not(:disabled), .k-back, .k-ghost'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const g of GAMES) {
  if (only && !only.includes(g)) continue
  for (const [w, h] of [[375, 667], [390, 844]] as const) {
    const p = await (await b.createBrowserContext()).newPage()
    await p.setViewport({ width: w, height: h, hasTouch: true, isMobile: true })
    await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
    await p.goto(`http://localhost:${port}/${g}/practice`, { waitUntil: 'domcontentloaded' })
    await new Promise((r) => setTimeout(r, 2600))
    const r = (await p.evaluate(`(() => {
      const board = Array.from(document.querySelectorAll(${JSON.stringify(BOARD)})).map(e => e.getBoundingClientRect()).filter(q => q.width > 50)[0]
      const sizes = {}
      for (const e of document.querySelectorAll(${JSON.stringify(TAPS)})) {
        const q = e.getBoundingClientRect(); if (!q.width) continue
        const key = (e.getAttribute('class') || e.tagName).split(' ')[0]
        const s = Math.round(Math.min(q.width, q.height))
        sizes[key] = Math.min(sizes[key] ?? 999, s)
      }
      const root = document.querySelector('.kg.hd, .app') || document.scrollingElement
      return { board: board ? Math.round(board.width) + 'x' + Math.round(board.height) + ' @y' + Math.round(board.top) + '-' + Math.round(board.bottom) : '-', scroll: Math.max(0, Math.round(root.scrollHeight - root.clientHeight)), small: Object.entries(sizes).filter(([, s]) => s < 40).map(([k, s]) => k + ':' + s).join(' ') }
    })()`)) as { board: string; scroll: number; small: string }
    console.log(`${g.padEnd(16)} ${w}x${h}  board ${r.board}  scroll ${r.scroll}  under40px[${r.small}]`)
    await p.screenshot({ path: `${out}/t-${g}-${w}.png` })
    await p.browserContext().close()
  }
}
await b.close()
