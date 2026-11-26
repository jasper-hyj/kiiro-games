import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/site/hover-flicker-test.ts [port]   (vite :5200) With a mouse (laptop): resting the pointer anywhere on something that reacts to
// hovering must not make it flash, and a real click (move, then press) must do what it says. Also taps on a touch screen.
const port = process.argv[2] || '5200'
setTimeout(() => {
  console.log('FAIL TIMEOUT')
  process.exit(1)
}, 280000)
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const open = async (path: string, ready: string, touch = false) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1280, height: 800 })
  await p.evaluateOnNewDocument(() => {
    ;(window as any).__name = (f: unknown) => f
    localStorage.setItem('kiiro-lang', 'en')
  })
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('FAIL page error', (e as Error).message)
  })
  await p.goto(`http://localhost:${port}${path}`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector(ready, { timeout: 15000 })
  await sleep(1200)
  return p
}
/** with the pointer resting at (x, y): how often does the screen under it change in one second? */
const flashes = async (p: Page, x: number, y: number) => {
  await p.mouse.move(x - 30, y - 30)
  await p.mouse.move(x, y, { steps: 4 })
  await sleep(450) // let transitions finish
  return (await p.evaluate(
    (px: number, py: number) =>
      new Promise<number>((resolve) => {
        let changes = 0,
          last = ''
        const start = performance.now()
        const frame = () => {
          const el = document.elementFromPoint(px, py)
          const host = el?.closest('button, g, [role=button]') ?? el
          const r = host?.getBoundingClientRect()
          const now = `${(el?.getAttribute('class') ?? el?.tagName) || ''}|${Math.round(r?.top ?? 0)}|${document.querySelectorAll('.gmghost, .hl, .wait-hl').length}|${host?.matches(':hover') ? 1 : 0}`
          if (last && now !== last) changes++
          last = now
          if (performance.now() - start < 900) requestAnimationFrame(frame)
          else resolve(changes)
        }
        requestAnimationFrame(frame)
      }),
    x,
    y,
  )) as number
}
const box = (p: Page, sel: string, n = 0) =>
  p.evaluate(
    (s: string, i: number) => {
      const r = document.querySelectorAll(s)[i]?.getBoundingClientRect()
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
    },
    sel,
    n,
  )

// the stone boards: hovering is steady and a click places a stone
for (const [game, count] of [
  ['gomoku', 2],
  ['go', 2],
] as const) {
  for (const path of [`/${game}/practice`, `/${game}/local`]) {
    const p = await open(path, '.gmboard')
    let steady = 0,
      placed = 0
    for (const n of [20, 31]) {
      for (let i = 0; i < 20 && !(await p.$('.gmhit')); i++) await sleep(200)
      await sleep(900) // the computer's turn
      const r = (await box(p, '.gmhit', n))!
      const x = r.x + r.w / 2,
        y = r.y + r.h / 2
      const calm = (await flashes(p, x, y)) <= 1
      const kept = !!(await p.$('.gmghost')) // a stone that covers the point vanishes as soon as it appears
      // the preview must never sit between the pointer and the point: that is what makes it flash and swallows the click
      const under = (await p.evaluate((px: number, py: number) => document.elementFromPoint(px, py)?.getAttribute('class') ?? '', x, y)) as string
      if (calm && kept && under === 'gmhit') steady++
      const before = (await p.$$('.gmst')).length
      await p.mouse.down()
      await p.mouse.up()
      await sleep(500)
      if ((await p.$$('.gmst')).length > before) placed++
    }
    ok(steady === count, `${path}: the preview stone does not flash under a resting pointer (${steady}/${count})`)
    ok(placed === count, `${path}: a mouse click places a stone (${placed}/${count})`)
    await p.browserContext().close()
  }
  // touch: tap shows the preview, tapping the same point again places it
  const p = await open(`/${game}/local`, '.gmboard', true)
  const r = (await box(p, '.gmhit', 40))!
  await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2)
  await sleep(300)
  await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2)
  await sleep(400)
  ok((await p.$$('.gmst')).length === 1, `${game} touch: tapping the same point twice places the stone`)
  await p.browserContext().close()
}

// things that lift when hovered: resting on any edge of them must not make them jump up and down
for (const [path, sel, ready] of [
  ['/bigtwo/practice', '.btcard:not(:disabled)', '.bthand'],
  ['/crazyeights/practice', '.c8card.ok', '.c8hand'],
  ['/hearts/practice', '.tkcard.ok', '.tkhand'],
  ['/mahjong/practice', '.handrow .tile.clickable', '.handrow .tile'],
  ['/blackjack/practice', '.bjchip:not(:disabled)', '.bjtable'],
  ['/chess/practice', '.chsq:not(:disabled)', '.chboard'],
  ['/reversi/practice', '.rvsq.ok', '.rvboard'],
  ['/checkers/practice', '.cksq.mv', '.ckboard'],
  ['/xiangqi/practice', '.xqcell.live', '.xqboard'],
  ['/chinesecheckers/practice', '.cclive', '.ccboard'],
  ['/yahtzee/practice', '.yzdice button', '.yzsheet'],
  ['/', '.kg-obj', '.kg-obj'],
  ['/', '.kg-create', '.kg-create'],
] as const) {
  const p = await open(path, ready)
  for (let i = 0; i < 40 && !(await p.$(sel)); i++) await sleep(300)
  const r = await box(p, sel)
  if (!r) {
    console.log('--  ', path, sel, 'nothing to hover right now')
    await p.browserContext().close()
    continue
  }
  const bad: string[] = []
  for (const [name, fx, fy] of [
    ['middle', 0.5, 0.5],
    ['bottom', 0.2, 0.98],
    ['top', 0.2, 0.02],
    ['left', 0.03, 0.5],
  ] as const) {
    const px = r.x + Math.max(1.5, r.w * fx),
      py = r.y + Math.min(r.h - 1.5, Math.max(1.5, r.h * fy))
    await p.mouse.move(2, 2)
    await sleep(300)
    const onIt = () =>
      p.evaluate((s: string, x: number, y: number) => !!document.querySelector(s)?.contains(document.elementFromPoint(x, y)), sel, px, py) as Promise<boolean>
    const was = await onIt() // (the corner of a round chip is not part of it)
    const n = await flashes(p, px, py)
    if (n > 3) bad.push(`${name}:${n}`)
    // a thing that lifts away from the pointer would drop and lift again for ever in a real window
    if (name === 'bottom' && was && !(await onIt()) && !/kg-obj/.test(sel)) bad.push(`${name}: slips away`)
  }
  ok(bad.length === 0, `${path} ${sel}: steady under a resting pointer (${bad.join(' ') || 'steady'})`)
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
