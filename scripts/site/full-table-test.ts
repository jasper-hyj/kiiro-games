import puppeteer from 'puppeteer-core'
import { makeTable } from '../lib/table'
// Run: npx tsx scripts/site/full-table-test.ts [outDir]   (wrangler :8787 + vite :5200) Eight people at one Hold'em and one Blackjack table: everybody
// gets a seat, a ninth only watches, and on phones and desktop no seat leaves the screen or covers another seat or the board.
const out = process.argv[2] || '/tmp'
const BASE = process.env.BASE ?? 'http://localhost:5200'
const WS = process.env.WS ?? 'ws://localhost:8787'
setTimeout(() => {
  console.log('FAIL TIMEOUT')
  process.exit(1)
}, 200000)
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })

for (const game of ['holdem', 'blackjack'] as const) {
  const code = await makeTable(game, game === 'holdem' ? { sb: 25, bb: 50, casual: true } : { bb: 10, casual: true })
  const clients: { ws: WebSocket; view: () => any }[] = []
  const join = async (i: number) => {
    const ws = new WebSocket(`${WS}/parties/main/${code}`)
    let view: any = null
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(String(e.data))
      if (m.view) view = m.view
    })
    await new Promise<void>((r) => ws.addEventListener('open', () => r()))
    ws.send(JSON.stringify({ t: 'join', id: `full-${game}-${code}-${i}`, name: i === 3 ? 'A very long name' : `Player ${i + 1}`, game }))
    await sleep(150)
    ws.send(JSON.stringify({ t: 'p', m: { k: 'sit', buyin: 0 } }))
    await sleep(150)
    clients.push({ ws, view: () => view })
  }
  for (let i = 0; i < 7; i++) await join(i)
  // the eighth sits through the screen
  const ctx = await b.createBrowserContext()
  const p = await ctx.newPage()
  await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
  await p.evaluateOnNewDocument(() => {
    ;(window as any).__name = (f: unknown) => f
    localStorage.setItem('kiiro-lang', 'en')
  })
  const errors: string[] = []
  p.on('pageerror', (e: unknown) => errors.push((e as Error).message))
  await p.goto(`${BASE}/${game}/${code}`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector(game === 'holdem' ? '.hdfelt' : '.bjtable', { timeout: 20000 })
  await sleep(1000)
  await p.waitForSelector('.hdsit button.primary')
  await p.click('.hdsit button.primary')
  await sleep(1500)
  await join(8) // a ninth person
  await sleep(1200)
  const seated = clients[0].view()?.seats?.filter((s: any) => !s.empty).length
  ok(seated === 8, `${game}: eight people are seated (${seated})`)
  ok(clients[7].view()?.you === -1, `${game}: a ninth person watches (${clients[7].view()?.you})`)
  if (game === 'blackjack') {
    for (const c of clients.slice(0, 7)) c.ws.send(JSON.stringify({ t: 'p', m: { k: 'act', a: { a: 'bet', amount: 10 } } }))
    await sleep(400)
    await p.evaluate(() => (document.querySelector('.bjchip') as HTMLElement | null)?.click())
    await sleep(200)
    await p.evaluate(() => (document.querySelector('.bjbetbar .hdbtn.primary') as HTMLElement | null)?.click())
    await sleep(2500)
  } else await sleep(2000)
  for (const [w, h] of [
    [390, 844],
    [375, 667],
    [320, 640],
    [1280, 800],
  ] as const) {
    await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
    await sleep(900)
    const problems = (await p.evaluate((g: string) => {
      const out: string[] = []
      const seats = Array.from(document.querySelectorAll(g === 'holdem' ? '.hdseat:not(.empty)' : '.bjseat')).map((e) => e.getBoundingClientRect())
      if (seats.length !== 8) out.push('seats on screen: ' + seats.length)
      const root = document.querySelector('.kg.hd') as HTMLElement
      if (root.scrollWidth > innerWidth + 1) out.push('sideways scroll ' + root.scrollWidth)
      const overlap = (a: DOMRect, b: DOMRect, slack: number) =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > slack && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > slack
      seats.forEach((s, i) => {
        if (s.left < -1 || s.right > innerWidth + 1) out.push(`seat ${i} leaves the screen (${Math.round(s.left)}..${Math.round(s.right)})`)
        seats.forEach((t, j) => {
          if (j > i && overlap(s, t, 6)) out.push(`seats ${i} and ${j} cover each other`)
        })
        const board = document.querySelector('.hdboard')?.getBoundingClientRect()
        if (board && overlap(s, board, 6)) out.push(`seat ${i} covers the board`)
      })
      for (const bet of Array.from(document.querySelectorAll('.hdbet')).map((e) => e.getBoundingClientRect()))
        seats.forEach((s, i) => {
          if (overlap(s, bet, 6)) out.push(`a bet is hidden by seat ${i}`)
        })
      return out.slice(0, 6)
    }, game)) as string[]
    ok(problems.length === 0, `${game} ${w}x${h}: eight seats fit (${problems.join('; ') || 'clean'})`)
    await p.screenshot({ path: `${out}/full-${game}-${w}.png` })
  }
  ok(errors.length === 0, `${game}: no page errors (${errors[0] ?? ''})`)
  for (const c of clients) c.ws.close()
  await ctx.close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
