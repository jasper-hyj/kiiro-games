import puppeteer, { type Page } from 'puppeteer-core'
const MK = (g: string, cfg: object) => `${process.env.BASE ?? 'http://localhost:5200'}/${g}?room=${1000 + Math.floor(Math.random() * 9000)}&make=1&cfg=${encodeURIComponent(JSON.stringify(cfg))}` // tables are made from a room now; this opens one directly
// Run: npx tsx scripts/cards/layout-audit.ts   (needs wrangler dev on :8787 and vite on :5200)
// Walks the new screens (hub, hold'em, blackjack, big two, admin) across phone and tablet sizes and reports overflow,
// off-screen or tiny buttons, clipped text and overlapping seats.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const BASE = process.env.BASE ?? 'http://localhost:5200'
const SIZES: [number, number][] = [
  [320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932], // phones, portrait
  [568, 320], [667, 375], [740, 360], [844, 390], [932, 430], // phones, landscape
  [768, 1024], [820, 1180], [1024, 1366], // tablets, portrait
  [1024, 768], [1180, 820], [1366, 1024], // tablets, landscape
  [1280, 720], [1920, 1080], // desktop
]
const only = (process.env.ONLY ?? '').split(',').filter(Boolean)
const SELECTED = only.length ? SIZES.filter(([w, h]) => only.includes(`${w}x${h}`)) : SIZES
const launch = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] })
let b = await launch()
let screens = 0, problems = 0
const report = (where: string, msgs: string[]) => { screens++; for (const m of msgs) { problems++; console.log('PROBLEM', where, '-', m) } }

/** Checks run inside the page. */
async function inspect(p: Page): Promise<string[]> {
  return p.evaluate(() => {
    const out: string[] = []
    const W = innerWidth
    if (document.documentElement.scrollWidth > W + 1) out.push(`horizontal overflow (${document.documentElement.scrollWidth} > ${W})`)
    const scroller = document.querySelector('.kg') as HTMLElement | null
    if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) out.push('page scrolls sideways')
    for (const el of Array.from(document.querySelectorAll('button, a.kg-go, a.kg-practice, a.kg-create, input, select'))) {
      const r = (el as HTMLElement).getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el as HTMLElement)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      if (r.right > W + 1 || r.left < -1) out.push(`control off-screen: ${(el.textContent || (el as HTMLInputElement).placeholder || el.tagName).trim().slice(0, 24)}`)
      const small = el.matches('.kgin input, .hdpresets button, .hdlink, .k-ghost, .kg-lang button, .kg-acct, .acchip, input[type=range], .kg-practice, .kg-go')
      if (!small && r.height < 36 && !el.closest('.kg-lang')) out.push(`tap target only ${Math.round(r.height)}px: ${(el.textContent || el.tagName).trim().slice(0, 24)}`)
    }
    // text that does not fit its box
    for (const el of Array.from(document.querySelectorAll('.k-seatname span:last-child, .k-seatsub, .hdlast, .hdmsg, .kg-game b'))) {
      const e = el as HTMLElement
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).textOverflow !== 'ellipsis') out.push(`text clipped: ${e.textContent?.slice(0, 24)}`)
    }
    // overlapping seats
    for (const sel of ['.hdseat:not(.empty)', '.bjseat', '.btseat']) {
      const rs = Array.from(document.querySelectorAll(sel)).map((e) => e.getBoundingClientRect())
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], c = rs[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) out.push(`${sel} ${i} overlaps ${j}`) }
      for (const r of rs) if (r.left < -1 || r.right > W + 1) out.push(`${sel} off-screen`)
    }
    // the action bar must be reachable: visible inside the viewport (it is sticky)
    const bar = document.querySelector('.hdbar') as HTMLElement | null
    if (bar) { const r = bar.getBoundingClientRect(); if (r.bottom > innerHeight + 2 || r.top < 0) out.push('action bar is not inside the viewport') }
    // the centre of the table must not be covered by a seat (cards of the board / current play)
    const centre = document.querySelector('.hdboard, .btplay, .bjdealer') as HTMLElement | null
    if (centre) {
      const c = centre.getBoundingClientRect()
      for (const s of Array.from(document.querySelectorAll('.hdseat:not(.empty), .btseat'))) { const r = s.getBoundingClientRect(); if (c.width && r.left < c.right - 2 && c.left < r.right - 2 && r.top < c.bottom - 2 && c.top < r.bottom - 2) out.push(`a seat covers the cards in the middle (seat ${[r.left, r.top, r.right, r.bottom].map(Math.round)} cards ${[c.left, c.top, c.right, c.bottom].map(Math.round)})`) }
    }
    // the bottom-left chat overlay must not sit on top of buttons, hand cards or seats
    const chat = document.querySelector('.kgchat') as HTMLElement | null
    if (chat) {
      const c = chat.getBoundingClientRect()
      if (c.left < -1 || c.right > W + 1 || c.top < 0) out.push('chat is off-screen')
      for (const el of Array.from(document.querySelectorAll('.hdbar button, .btcard, .hdseat:not(.empty), .bjseat, .btseat, .hdraise, .hdboard, .btplay, .bjdealer, .bjchip'))) {
        const r = (el as HTMLElement).getBoundingClientRect()
        if (r.width && r.height && r.left < c.right - 1 && c.left < r.right - 1 && r.top < c.bottom - 1 && c.top < r.bottom - 1) out.push(`chat covers ${(el.className || el.tagName).toString().slice(0, 20)} "${(el.textContent || '').trim().slice(0, 16)}"`)
      }
    }
    return out
  })
}
const mk = async (w: number, h: number) => {
  const ctx = await b.createBrowserContext()
  const p = await ctx.newPage()
  await p.setViewport({ width: w, height: h, hasTouch: w < 1000, isMobile: w < 1000 })
  await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en') })
  p.on('pageerror', (e: unknown) => { problems++; console.log('PAGEERROR', (e as Error).message) })
  return p
}
const closeAll = async (...ps: Page[]) => { for (const p of ps) await p.browserContext().close() }

for (const [w, h] of SELECTED) {
  if (!b.connected) b = await launch() // a crashed browser must not sink every later size
  else if (screens > 0 && screens % 24 === 0) { await b.close().catch(() => {}); b = await launch() } // a fresh browser now and then keeps memory down
  const tag = `${w}x${h}`
  const section = async (name: string, fn: () => Promise<void>) => { try { await fn() } catch { try { await fn() } catch (e) { problems++; console.log('PROBLEM', name, tag, '- could not run:', String((e as Error).message).split('\n')[0]) } } }
  await section('hub+menus', async () => {
    const p = await mk(w, h)
    // hub
    await p.goto(BASE + '/', { waitUntil: 'networkidle0' }); report(`hub ${tag}`, await inspect(p))
    await p.goto(BASE + '/holdem', { waitUntil: 'networkidle0' }); report(`holdem menu ${tag}`, await inspect(p))
    await p.goto(BASE + '/blackjack', { waitUntil: 'networkidle0' }); report(`blackjack menu ${tag}`, await inspect(p))
    await p.goto(BASE + '/bigtwo', { waitUntil: 'networkidle0' }); report(`bigtwo menu ${tag}`, await inspect(p))
    await closeAll(p)
  })
  await section('room', async () => {
    // the room page: host with the game chooser and rules, a guest watching the host's choice
    const [A, B] = [await mk(w, h), await mk(w, h)]
    await A.goto(`${BASE}/room?create=1&pick=holdem`, { waitUntil: 'networkidle0' }); await A.waitForSelector('.rmpeople')
    const room = new URL(A.url()).searchParams.get('room')
    await B.goto(`${BASE}/room?room=${room}`, { waitUntil: 'networkidle0' }); await B.waitForSelector('.rmpeople'); await sleep(700)
    report(`room host ${tag}`, await inspect(A)); report(`room guest ${tag}`, await inspect(B))
    await A.goto(`${BASE}/room`, { waitUntil: 'networkidle0' }); report(`room menu ${tag}`, await inspect(A))
    await closeAll(A, B)
  })
  await section('holdem', async () => {
    // hold'em with three players (casual): preflop with action, then after a flop
    const [A, B, C] = [await mk(w, h), await mk(w, h), await mk(w, h)]
    await A.goto(BASE + '/holdem', { waitUntil: 'networkidle0' })
    await A.goto(MK('holdem', { sb: 25, bb: 50, casual: true })); await A.waitForSelector('.hdfelt')
    const room = new URL(A.url()).searchParams.get('room')
    for (const x of [B, C]) { await x.goto(`${BASE}/holdem?room=${room}`, { waitUntil: 'networkidle0' }); await x.waitForSelector('.hdfelt') }
    report(`holdem not seated ${tag}`, await inspect(A))
    for (const x of [A, B, C]) { await x.click('.hdsit .hdbtn.primary'); await sleep(200) }
    await sleep(900)
    report(`holdem preflop ${tag}`, await inspect(A))
    for (let k = 0; k < 3; k++) for (const x of [A, B, C]) { const btn = await x.$('.hdactions .hdbtn.primary'); if (btn) { await btn.click(); await sleep(150) } }
    await sleep(500)
    for (const x of [A, B, C]) { if (await x.$('.hdraise')) { report(`holdem my turn with raise controls ${tag}`, await inspect(x)); break } }
    report(`holdem flop ${tag}`, await inspect(A))
    await closeAll(A, B, C)
  })
  await section('blackjack', async () => {
    const p = await mk(w, h)
    // blackjack solo: bet bar, play bar, result
    await p.goto(BASE + '/blackjack', { waitUntil: 'networkidle0' })
    await p.goto(MK('blackjack', { bb: 10, casual: true })); await p.waitForSelector('.bjtable')
    await p.click('.hdsit .hdbtn.primary'); await p.waitForSelector('.bjchips'); await sleep(300)
    report(`blackjack betting ${tag}`, await inspect(p))
    const chip = await p.$('.bjchip'); if (chip) { await chip.click(); await chip.click() }
    await p.click('.bjbetbar .hdbtn.primary'); await sleep(1200)
    report(`blackjack play ${tag}`, await inspect(p))
    for (let i = 0; i < 8; i++) { const s = await p.$('.hdactions .hdbtn'); if (s) { await s.click(); await sleep(400) } }
    await sleep(2200)
    report(`blackjack result ${tag}`, await inspect(p))
    await closeAll(p)
  })
  await section('bigtwo', async () => {
    const p = await mk(w, h)
    // big two: lobby, table, a selection
    await p.goto(BASE + '/bigtwo', { waitUntil: 'networkidle0' })
    await p.goto(MK('bigtwo', {})); await p.waitForSelector('.btlobby')
    report(`bigtwo lobby ${tag}`, await inspect(p))
    await p.$eval('.hdform .hdbtn.primary', (e) => e.scrollIntoView({ block: 'center' })) // a player scrolls the page clear of the chat first
    await p.click('.hdform .hdbtn.primary'); await p.waitForSelector('.bthand .btcard'); await sleep(1500)
    const cards = await p.$$('.bthand .btcard'); if (cards[0]) await cards[0].click(); await sleep(150)
    report(`bigtwo table ${tag}`, await inspect(p))
    await closeAll(p)
  })
}
await b.close()
console.log(`${screens} screens checked, ${problems} problems`)
process.exit(problems ? 1 : 0)
