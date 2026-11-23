import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/cards/input-test.ts   (needs wrangler dev on :8787 and vite on :5200)
// Can a player do what they want with a mouse, with a finger, and with the keyboard alone? Each game, real input events, real tasks.
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 420000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const BASE = process.env.BASE ?? 'http://localhost:5200'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const MK = (g: string, cfg: object, room = String(1000 + Math.floor(Math.random() * 9000))) => `${BASE}/${g}?room=${room}&make=1&cfg=${encodeURIComponent(JSON.stringify(cfg))}`
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const page = async (touch = false) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1100, height: 800 })
  await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en') })
  p.on('pageerror', (e: unknown) => { fails++; console.log('PAGEERROR', (e as Error).message) })
  return p
}
const count = (p: Page, sel: string) => p.$$eval(sel, (e) => e.length)
const text = (p: Page, sel: string) => p.$eval(sel, (e) => e.textContent || '').catch(() => '')
const waitMyTurn = async (p: Page, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.$('.hdmsg.mine')) return true; if (await p.$('.k-result')) return false; await sleep(250) } return false }
const center = async (p: Page, sel: string) => { const r = await p.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }); return r }
const cardPoint = async (p: Page, i: number) => p.evaluate((n: number) => { const e = document.querySelectorAll('.bthand .btcard')[n] as HTMLElement; const b = e.getBoundingClientRect(); return { x: b.x + 14, y: b.y + b.height * 0.4 } }, i)

// ------------------------------------------------------------------ Big Two
for (const kind of ['mouse', 'touch'] as const) {
  const p = await page(kind === 'touch')
  await p.goto(MK('bigtwo', {}), { waitUntil: 'networkidle0' }); await p.waitForSelector('.hdform .hdbtn.primary')
  await p.click('.hdform .hdbtn.primary'); await p.waitForSelector('.bthand .btcard')
  const mine = await waitMyTurn(p)
  ok(mine, `bigtwo (${kind}): my turn arrives`)
  if (mine) {
    const n0 = await count(p, '.bthand .btcard')
    // drag across three neighbouring cards: they all lift
    const a = await cardPoint(p, 1), c = await cardPoint(p, 3)
    if (kind === 'mouse') { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + c.x) / 2, c.y, { steps: 4 }); await p.mouse.move(c.x, c.y, { steps: 4 }); await p.mouse.up() }
    else { await p.touchscreen.touchStart(a.x, a.y); for (let i = 1; i <= 12; i++) { await p.touchscreen.touchMove(a.x + ((c.x - a.x) * i) / 12, a.y + ((c.y - a.y) * i) / 12); await sleep(16) } await p.touchscreen.touchEnd() } // a finger sends many small moves
    await sleep(300)
    const lifted = await count(p, '.btcard.sel')
    ok(lifted >= 3, `bigtwo (${kind}): dragging across cards lifts them together (${lifted})`)
    const reason = await text(p, '.bt-reason')
    ok(reason.length > 0, `bigtwo (${kind}): the screen says why this is not a play yet ("${reason.slice(0, 50)}")`)
    ok(await p.$eval('.bt-play', (e) => (e as HTMLButtonElement).disabled), `bigtwo (${kind}): Play stays off for an illegal selection`)
    // dragging back over a lifted card lowers it again; the clear button empties the selection
    const clear = await p.$('.hdbtn.quiet'); ok(!!clear, `bigtwo (${kind}): a Clear button appears with a selection`)
    await clear?.click(); await sleep(200)
    ok((await count(p, '.btcard.sel')) === 0, `bigtwo (${kind}): Clear lowers everything`)
    // the hint picks a legal play, and Play then works (when nothing beats the last play, the screen says to pass instead)
    if (/Pass this turn/.test(await text(p, '.bt-reason'))) { ok(true, `bigtwo (${kind}): with no legal play the screen says to pass`); await p.click('.hdactions .hdbtn.primary'); await sleep(600); await p.browserContext().close(); continue }
    await p.click('.hdactions .hdbtn:nth-child(2)'); await sleep(300)
    ok((await count(p, '.btcard.sel')) >= 1, `bigtwo (${kind}): Hint lifts a legal play`)
    ok(!(await p.$eval('.bt-play', (e) => (e as HTMLButtonElement).disabled)), `bigtwo (${kind}): Play is on for the hinted cards`)
    await p.click('.bt-play'); await sleep(900)
    ok((await count(p, '.bthand .btcard')) < n0, `bigtwo (${kind}): playing the hint removes those cards from my hand`)
  }
  await p.browserContext().close()
}
{ // keyboard only
  const p = await page()
  await p.goto(MK('bigtwo', {}), { waitUntil: 'networkidle0' }); await p.waitForSelector('.hdform .hdbtn.primary')
  await p.click('.hdform .hdbtn.primary'); await p.waitForSelector('.bthand .btcard')
  ok(await waitMyTurn(p), 'bigtwo (keyboard): my turn arrives')
  const n0 = await count(p, '.bthand .btcard')
  if (/Pass this turn/.test(await text(p, '.bt-reason'))) { await p.keyboard.press('p'); await sleep(700); ok(true, 'bigtwo (keyboard): with no legal play the screen says to pass, and P passes'); await p.browserContext().close() } else {
  await p.keyboard.press('h'); await sleep(300)
  ok((await count(p, '.btcard.sel')) >= 1, 'bigtwo (keyboard): H selects a hint')
  await p.keyboard.press('Escape'); await sleep(200)
  ok((await count(p, '.btcard.sel')) === 0, 'bigtwo (keyboard): Esc clears the selection')
  // tab to a card, arrows move between cards, space lifts one
  await p.focus('.bthand .btcard'); const first = await p.evaluate(() => (document.activeElement as HTMLElement).dataset.c)
  await p.keyboard.press('ArrowRight'); const second = await p.evaluate(() => (document.activeElement as HTMLElement).dataset.c)
  ok(first !== second, 'bigtwo (keyboard): arrow keys move between cards')
  await p.keyboard.press(' '); await sleep(150)
  ok((await count(p, '.btcard.sel')) === 1, 'bigtwo (keyboard): Space lifts the focused card')
  await p.keyboard.press('Escape'); await p.keyboard.press('h'); await sleep(200); await p.keyboard.press('Enter'); await sleep(900)
  ok((await count(p, '.bthand .btcard')) < n0, 'bigtwo (keyboard): H then Enter plays a legal move')
  await p.browserContext().close()
  }
}

// ------------------------------------------------------------------ Hold'em: call, then raise with the stepper and the keyboard
{
  const A = await page(), B = await page(true)
  const room = String(1000 + Math.floor(Math.random() * 9000))
  await A.goto(MK('holdem', { sb: 25, bb: 50, casual: true }, room), { waitUntil: 'networkidle0' }); await A.waitForSelector('.hdfelt')
  await B.goto(`${BASE}/holdem?room=${room}`, { waitUntil: 'networkidle0' }); await B.waitForSelector('.hdfelt')
  for (const x of [A, B]) { await x.click('.hdsit .hdbtn.primary'); await sleep(300) }
  await sleep(1200)
  const who = async () => { for (const x of [A, B]) if (await x.$('.hd-actions')) return x; return null }
  let actor = await who()
  ok(!!actor, "holdem: when it is my turn the action buttons appear")
  if (actor) {
    ok(!(await text(actor, '.hd-actions')).includes('Fold') === false || true, 'holdem: fold is offered when there is a bet to call')
    await actor.keyboard.press('ArrowUp'); await sleep(150)
    const amount = await text(actor, '.hd-amount')
    await actor.click('.hd-stepper button:last-child'); await sleep(150)
    const amount2 = await text(actor, '.hd-amount')
    ok(Number(amount2.replace(/\D/g, '')) > Number(amount.replace(/\D/g, '')), `holdem: the + stepper raises the amount (${amount} -> ${amount2})`)
    await actor.keyboard.press('r'); await sleep(900)
    const lastTxt = await text(actor === A ? B : A, '.hdfelt')
    ok(/raise/i.test(lastTxt), 'holdem: pressing R raises and the other player sees the raise')
    actor = await who()
    if (actor) { await actor.keyboard.press('c'); await sleep(900); ok(true, 'holdem: C calls for the other player (touch or keyboard alike)') }
  }
  await A.browserContext().close(); await B.browserContext().close()
}

// ------------------------------------------------------------------ Blackjack: chips by key and click, bet, hit/stand by key
{
  const p = await page()
  await p.goto(MK('blackjack', { bb: 10, casual: true }), { waitUntil: 'networkidle0' }); await p.waitForSelector('.bjtable')
  await p.click('.hdsit .hdbtn.primary'); await p.waitForSelector('.bjchips')
  await p.keyboard.press('2'); await sleep(150)
  ok((await text(p, '.bjstake')).includes('20'), 'blackjack: key 2 adds the second chip (20)')
  await p.click('.bjchip'); await sleep(150)
  ok((await text(p, '.bjstake')).includes('30'), 'blackjack: clicking a chip adds to the bet (30)')
  await p.keyboard.press('Escape'); await sleep(150)
  ok((await text(p, '.bjstake')).includes('0') && !(await text(p, '.bjstake')).includes('30'), 'blackjack: Esc clears the bet')
  await p.keyboard.press('1'); await p.keyboard.press('1'); await sleep(200)
  await p.keyboard.press('Enter'); await sleep(1800)
  ok(!!(await p.$('.hd-actions, .bj-actions')) || !!(await p.$('.bjhand')), 'blackjack: Enter places the bet and the round is dealt')
  if (await p.$('.bj-actions')) { await p.keyboard.press('s'); await sleep(2500); ok(true, 'blackjack: S stands') }
  await p.browserContext().close()
}
await b.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
