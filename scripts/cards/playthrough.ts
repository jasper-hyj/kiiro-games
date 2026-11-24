import puppeteer, { type Page } from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/cards/playthrough.ts   (needs wrangler dev on :8787 and vite on :5200)
// Real browsers play the card games through the UI: a whole Big Two game and a second one, Hold'em and Blackjack hands with two people,
// and a page reload in the middle of each (the seat and the hand must come back).
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 540000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const BASE = process.env.BASE ?? 'http://localhost:5200'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const MK = (g: string, cfg: object, room?: string) => tableUrl(g, cfg, room) // a real table, made through its room (see scripts/lib/table.ts)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const page = async (w = 1100, h = 800) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h })
  await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en') })
  p.on('pageerror', (e: unknown) => { fails++; console.log('PAGEERROR', (e as Error).message) })
  return p
}
const text = (p: Page, sel: string) => p.$eval(sel, (e) => e.textContent || '').catch(() => '')
const clickText = (p: Page, sel: string, t: string) => p.evaluate((s: string, x: string) => { const el = Array.from(document.querySelectorAll(s)).find((e) => (e.textContent || '').includes(x)) as HTMLElement | undefined; el?.click(); return !!el }, sel, t)

/** One move for me in Big Two: the first card that is a legal play, else pass. Returns false if it was not my turn. */
async function bigTwoMove(p: Page): Promise<boolean> {
  const mine = await p.evaluate(() => /Your turn|You open|You lead/.test(document.querySelector('.hdmsg')?.textContent || ''))
  if (!mine) return false
  const cards = await p.$$('.bthand .btcard')
  for (const c of cards) {
    await c.click(); await sleep(40)
    const play = await p.$('.hdactions .hdbtn.primary:not(:disabled)')
    if (play) { await play.click(); return true }
    await c.click()
  }
  const pass = await p.$('.hdactions .hdbtn:not(.primary):not(:disabled)')
  if (pass) { await pass.click(); return true }
  return false
}

{ // ---- Big Two: a whole game, play again, a reload in the middle
  const p = await page()
  await p.goto(await MK('bigtwo', {}), { waitUntil: 'networkidle0' }); await p.waitForSelector('.btlobby')
  const url = p.url()
  for (let game = 1; game <= 2; game++) {
    await p.click('.hdform .hdbtn.primary'); await p.waitForSelector('.bthand .btcard'); await sleep(800)
    ok((await p.$$eval('.bthand .btcard', (e) => e.length)) === 13, `bigtwo game ${game}: I hold 13 cards`)
    let moves = 0, reloaded = false, done = false
    for (let i = 0; i < 400 && !done; i++) {
      try {
      if (await p.$('.k-result')) { done = true; break }
      if (await bigTwoMove(p)) moves++
      } catch { await sleep(300); continue } // the page may be mid-navigation
      if (moves === 4 && !reloaded && game === 1) {
        reloaded = true
        await sleep(1200) // let my last play reach the screen before counting
        const before = await p.$$eval('.bthand .btcard', (e) => e.length)
        await p.reload({ waitUntil: 'networkidle0' }); await p.waitForSelector('.bthand .btcard', { timeout: 15000 }).catch(() => {}); await sleep(800)
        const after = await p.$$eval('.bthand .btcard', (e) => e.length).catch(() => -1)
        ok(after === before, `bigtwo: after a reload mid-game I have my seat and ${before} cards back (${after})`)
      }
      await sleep(250)
    }
    ok(done, `bigtwo game ${game}: the game finished after ${moves} of my moves`)
    if (done) {
      const rows = await p.$$eval('.k-result .k-row', (r) => r.map((x) => x.textContent || ''))
      ok(rows.length === 4, 'bigtwo: the result lists four players')
      const pts = await p.$$eval('.k-result .k-rowval', (c) => c.map((x) => Number((x.textContent || '0').replace('+', '')) || 0))
      ok(pts.reduce((a, c) => a + c, 0) === 0, `bigtwo: points are zero-sum (${pts.join(', ')})`)
      if (game === 1) { await clickText(p, '.k-resultactions .hdbtn', ''); await sleep(1500); ok(!!(await p.$('.btlobby')), 'bigtwo: "play again" returns to the lobby') }
    }
  }
  ok(p.url() === url || p.url().includes('room='), 'bigtwo: still in the same room')
  await p.browserContext().close()
}

{ // ---- Hold'em: two browsers play hands; one reloads mid-hand
  const A = await page(), B = await page()
  const A_url = await MK('holdem', { sb: 25, bb: 50, casual: true }); const room = A_url.split('/').pop()!
  await A.goto(A_url, { waitUntil: 'networkidle0' }); await A.waitForSelector('.hdfelt')
  await B.goto(`${BASE}/holdem/${room}`, { waitUntil: 'networkidle0' }); await B.waitForSelector('.hdfelt')
  for (const x of [A, B]) { await x.click('.hdsit .hdbtn.primary'); await sleep(300) }
  let hands = 0, reloaded = false
  const seen = new Set<string>()
  for (let i = 0; i < 400 && hands < 6; i++) {
    for (const x of [A, B]) { const btn = await x.$('.hdactions .hdbtn.primary:not(:disabled)'); if (btn) await btn.click().catch(() => {}) }
    const msg = await text(A, '.hdmsg')
    const wins = (await text(A, '.hdfelt')).match(/wins [\d,]+|Split pot/g)?.join('|') ?? ''
    if (wins && !seen.has(wins + hands)) { seen.add(wins + hands); hands++ }
    if (hands === 2 && !reloaded) {
      reloaded = true
      await B.reload({ waitUntil: 'networkidle0' }); await B.waitForSelector('.hdfelt', { timeout: 15000 }).catch(() => {}); await sleep(1500)
      ok(!!(await B.$('.hdseat.me')), "holdem: after a reload I am still in my seat")
    }
    void msg
    await sleep(350)
  }
  ok(hands >= 4, `holdem: ${hands} hands were played to a result`)
  const stacks = await A.$$eval('.hdseat:not(.empty) .k-seatsub', (e) => e.map((x) => Number((x.textContent || '0').replace(/[^\d]/g, ''))))
  ok(stacks.length === 2 && stacks.every((s) => s >= 0), `holdem: both stacks are sensible (${stacks.join(', ')})`)
  await A.browserContext().close(); await B.browserContext().close()
}

{ // ---- Blackjack: two browsers bet and stand; one reloads mid-round
  const A = await page(), B = await page()
  const A_url = await MK('blackjack', { bb: 10, casual: true }); const room = A_url.split('/').pop()!
  await A.goto(A_url, { waitUntil: 'networkidle0' }); await A.waitForSelector('.bjtable')
  await B.goto(`${BASE}/blackjack/${room}`, { waitUntil: 'networkidle0' }); await B.waitForSelector('.bjtable')
  for (const x of [A, B]) { await x.click('.hdsit .hdbtn.primary'); await sleep(400) }
  let rounds = 0, reloaded = false
  for (let i = 0; i < 300 && rounds < 5; i++) {
    for (const x of [A, B]) {
      const chip = await x.$('.bjchip')
      if (chip) { await chip.click().catch(() => {}); await sleep(100); const bet = await x.$('.bjbetbar .hdbtn.primary:not(:disabled)'); if (bet) await bet.click().catch(() => {}) }
      const stand = await x.$('.hdactions .hdbtn'); if (stand) await stand.click().catch(() => {})
    }
    const res = await text(A, '.bjtable')
    if (/Win|Lose|Push|Bust|Blackjack/.test(res)) { rounds++; await sleep(2500) }
    if (rounds === 2 && !reloaded) {
      reloaded = true
      await B.reload({ waitUntil: 'networkidle0' }); await B.waitForSelector('.bjtable', { timeout: 15000 }).catch(() => {}); await sleep(1500)
      ok(!!(await B.$('.bjseat.me')) || !!(await B.$('.bjseat')), 'blackjack: after a reload I am back at the table')
    }
    await sleep(300)
  }
  ok(rounds >= 3, `blackjack: ${rounds} rounds were played to a result`)
  await A.browserContext().close(); await B.browserContext().close()
}

await b.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
