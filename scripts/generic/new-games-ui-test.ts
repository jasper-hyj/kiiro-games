import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/generic/new-games-ui-test.ts [port]   (vite) A person plays the newer games through the screen against bots, with taps on a phone:
// whole deals of Hearts and Spades, a game of Reversi, a Go game ended by passing, and several turns of Checkers and Chinese Checkers.
const port = process.argv[2] || '5200'
const only = process.argv[3]?.split(',')
setTimeout(() => {
  console.log('FAIL TIMEOUT')
  process.exit(1)
}, 600000)
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const open = async (game: string, ready: string) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('FAIL page error', game, (e as Error).message)
  })
  await p.goto(`http://localhost:${port}/${game}/practice`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector(ready)
  return p
}
/** tap the middle of the visible part of an element, the way a finger would: whatever is on top there gets it */
const tap = async (p: Page, selector: string, nth = 0) => {
  const at = (await p.evaluate(
    (s, n) => {
      const el = document.querySelectorAll(s)[n] as Element | undefined
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      // the first point along the top strip that really belongs to the element (overlapped cards show only their left edge)
      for (const fx of [0.5, 0.25, 0.12]) {
        const x = r.left + r.width * fx,
          y = r.top + r.height * 0.4
        const hit = document.elementFromPoint(x, y)
        if (hit && (el === hit || el.contains(hit))) return { x, y }
      }
      return null
    },
    selector,
    nth,
  )) as { x: number; y: number } | null
  if (!at) return false
  await p.touchscreen.tap(at.x, at.y)
  return true
}
const over = (p: Page) => p.$('.k-result')
const result = (p: Page) => p.$eval('.k-result', (e) => e.textContent || '')
const want = (g: string) => !only || only.includes(g)

for (const game of ['hearts', 'spades']) {
  if (!want(game)) continue
  const p = await open(game, '.tk')
  let played = 0,
    passed = false,
    bid = false,
    stuck = 0
  for (let i = 0; i < 400 && !(await over(p)); i++) {
    const state = (await p.evaluate(() => ({
      pass: !!Array.from(document.querySelectorAll('.tkmine .hdbtn.primary')).length,
      bids: document.querySelectorAll('.tkbids button').length,
      ok: document.querySelectorAll('.tkcard.ok').length,
    }))) as { pass: boolean; bids: number; ok: number }
    if (state.pass) {
      for (let k = 0; k < 3; k++) {
        const n = (await p.evaluate(() => Array.from(document.querySelectorAll('.tkcard')).findIndex((e) => !e.classList.contains('sel')))) as number
        await tap(p, '.tkcard', n)
        await sleep(120)
      }
      passed = await tap(p, '.tkmine .hdbtn.primary')
    } else if (state.bids) bid = await tap(p, '.tkbids button', 3)
    else if (state.ok) {
      if (await tap(p, '.tkcard.ok', 0)) played++
      else if (++stuck > 3) break
    }
    await sleep(450)
  }
  if (game === 'hearts') ok(passed, 'hearts: three cards chosen and passed by tapping')
  else ok(bid, 'spades: a bid made by tapping')
  ok(played === 13 && !!(await over(p)), `${game}: a whole deal of 13 cards played by tapping (${played}, stuck ${stuck})`)
  if (await over(p)) ok(/win|draw/i.test(await result(p)), `${game}: the result is shown (${(await result(p)).slice(0, 60)})`)
  if (game === 'spades' && (await over(p))) ok(/ & .+ win|draw/i.test(await result(p)), 'spades: the result names both partners')
  if (await over(p)) ok(!/\.5/.test(await result(p)), `${game}: scores are shown in the game's own terms`)
  await p.browserContext().close()
}

if (want('reversi')) {
  const p = await open('reversi', '.rvboard')
  let moves = 0
  for (let i = 0; i < 300 && !(await over(p)); i++) {
    if ((await p.$$('.rvsq.ok')).length && (await tap(p, '.rvsq.ok'))) moves++
    await sleep(400)
  }
  ok(!!(await over(p)) && moves >= 5, `reversi: a whole game played by tapping (${moves} moves)`)
  await p.browserContext().close()
}
if (want('go')) {
  const p = await open('go', '.gmboard')
  // two placements (tap, then confirm), then pass until the game ends
  for (let n = 0; n < 2; n++) {
    for (let i = 0; i < 20 && !(await p.$('.gmconfirm .hdbtn')); i++) await sleep(300)
    await tap(p, '.gmhit', 30 + n * 7)
    await sleep(200)
    await tap(p, '.gmconfirm .hdbtn.primary')
    await sleep(1300)
  }
  ok((await p.$$('.gmst')).length >= 4, "go: my stones and the computer's answers are on the board")
  for (let i = 0; i < 200 && !(await over(p)); i++) {
    await p.evaluate(() =>
      (Array.from(document.querySelectorAll('.gmconfirm button')).find((e) => e.textContent === 'Pass') as HTMLElement | undefined)?.click(),
    )
    await sleep(500)
  }
  ok(!!(await over(p)), 'go: passing ends the game with a result')
  await p.browserContext().close()
}
if (want('checkers')) {
  const p = await open('checkers', '.ckboard')
  let moves = 0
  for (let i = 0; i < 80 && moves < 8 && !(await over(p)); i++) {
    if ((await p.$$('.cksq.mv')).length) {
      await tap(p, '.cksq.mv')
      await sleep(150)
      if (await tap(p, '.cksq.tgt')) moves++
    }
    await sleep(600)
  }
  ok(moves >= 5 || !!(await over(p)), `checkers: moves made by tapping (${moves})`)
  await p.browserContext().close()
}
if (want('chinesecheckers')) {
  const p = await open('chinesecheckers', '.ccboard')
  let moves = 0
  for (let i = 0; i < 80 && moves < 6; i++) {
    const live = (await p.$$('.cclive')).length
    if (live) {
      await tap(p, '.cclive', moves % live)
      await sleep(150)
      // a highlighted hole
      const at = (await p.evaluate(() => {
        const d = document.querySelector('.ccdest')
        if (!d) return null
        const r = d.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      })) as { x: number; y: number } | null
      if (at) {
        await p.touchscreen.tap(at.x, at.y)
        moves++
      }
    }
    await sleep(600)
  }
  ok(moves >= 6, `chinese checkers: marbles moved by tapping (${moves})`)
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
