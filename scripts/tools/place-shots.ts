import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/tools/place-shots.ts <outDir> [game,...]   (vite :5200) Every game in the middle of play on a desktop, a phone and a tablet held
// sideways, after a first move where the game allows Undo, to judge where the controls sit.
const out = process.argv[2] || '.'
const only = process.argv[3]?.split(',')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const UNDO = ['gomoku', 'chess', 'xiangqi', 'go', 'checkers', 'reversi', 'chinesecheckers']
const GAMES = [...UNDO, 'yahtzee', 'liarsdice', 'crazyeights', 'doudizhu', 'bridge', 'hearts', 'spades', 'bigtwo', 'holdem', 'blackjack', 'mahjong']
/** one legal move on this device, so that the Undo button is there */
async function move(p: Page, game: string) {
  const tap = async (sel: string, n = 0) => {
    const els = await p.$$(sel)
    const r = els[n % Math.max(1, els.length)] && (await els[n % els.length].boundingBox())
    if (r) await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2)
    await sleep(350)
  }
  if (game === 'gomoku' || game === 'go') {
    await tap('.gmhit', 40)
    if (await p.$('.gmconfirm .hdbtn.primary')) await tap('.gmhit', 40)
  } else if (game === 'checkers') {
    await tap('.cksq.mv')
    await tap('.cksq.tgt')
  } else if (game === 'reversi') await tap('.rvsq.ok')
  else if (game === 'chess') {
    await tap('.chsq:nth-child(53)')
    await tap('.chsq:nth-child(37)')
  } else if (game === 'xiangqi') {
    for (let i = 0; i < 6 && !(await p.$('.plundo')); i++) {
      await tap('.xqcell.live', i)
      await tap('.xqcell.tgt, .xqcell.dest', 0)
    }
  } else if (game === 'chinesecheckers') {
    for (let i = 0; i < 8 && !(await p.$('.plundo')); i++) {
      await tap('.cclive', i)
      const d = await p.$('.ccdest')
      const r = d && (await d.boundingBox())
      if (r) await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2)
      await sleep(350)
    }
  }
}
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const game of GAMES) {
  if (only && !only.includes(game)) continue
  for (const [name, w, h] of [
    ['desk', 1280, 800],
    ['phone', 390, 760],
    ['tab', 1024, 700],
  ] as const) {
    const p = await (await b.createBrowserContext()).newPage()
    const touch = name !== 'desk'
    await p.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch })
    await p.goto(`http://localhost:5200/${game}/${UNDO.includes(game) ? 'local' : 'practice'}`, { waitUntil: 'domcontentloaded' })
    await sleep(2200)
    if (UNDO.includes(game)) await move(p, game)
    await sleep(500)
    const info = await p.evaluate(() => {
      const el = document.querySelector('.kg.hd, .app') as HTMLElement | null
      const u = document.querySelector('.plundo')?.getBoundingClientRect()
      return { scroll: el ? el.scrollHeight - el.clientHeight : 0, undo: u ? `${Math.round(u.left)},${Math.round(u.top)}` : '-' }
    })
    console.log(game, name, 'scrolls by', info.scroll, 'undo at', info.undo)
    await p.screenshot({ path: `${out}/pl-${name}-${game}.png` })
    await p.browserContext().close()
  }
}
await b.close()
