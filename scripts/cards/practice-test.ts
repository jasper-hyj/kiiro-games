import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/practice-test.ts   (needs vite on :5200; the game server is NOT needed - practice runs in the browser)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const BASE = process.env.BASE ?? 'http://localhost:5200'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const open = async (path: string) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 800, height: 900 })
  await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en') })
  const net: string[] = []
  p.on('request', (r) => { if (/:8787|workers\.dev/.test(r.url())) net.push(r.url()) })
  p.on('pageerror', (e: unknown) => { fails++; console.log('pageerror', (e as Error).message) })
  await p.goto(BASE + path, { waitUntil: 'networkidle0' })
  return { p, net }
}
const clickText = (p: any, sel: string, text: string) => p.evaluate((s: string, t: string) => { const el = Array.from(document.querySelectorAll(s)).find((e) => (e.textContent || '').includes(t)) as HTMLElement | undefined; el?.click(); return !!el }, sel, text)

{ // blackjack
  const { p } = await open('/blackjack')
  ok(await clickText(p, '.hdbtn', 'Practice offline'), 'blackjack menu has an offline practice button')
  await p.waitForSelector('.bjtable'); await p.waitForSelector('.bjchips'); await sleep(300)
  const chip = await p.$('.bjchip'); await chip!.click(); await chip!.click()
  await p.click('.bjbetbar .hdbtn.primary'); await sleep(1200)
  const cards = await p.$$eval('.bjseat .pkcard', (e) => e.length)
  ok(cards >= 2, `cards are dealt in practice (${cards})`)
  for (let i = 0; i < 8; i++) { const s = await p.$('.hdactions .hdbtn'); if (s) { await s.click(); await sleep(450) } }
  await sleep(2200)
  const out = await p.$eval('.bjtable', (e) => e.textContent || '')
  ok(/Win|Lose|Push|Bust|Blackjack/.test(out), 'the round ends with a result')
  const stack = await p.$eval('.bjseat .hdstack', (e) => e.textContent)
  ok(!!stack, `a stack is shown (${stack})`)
  await p.browserContext().close()
}
{ // big two
  const { p } = await open('/bigtwo')
  ok(await clickText(p, '.hdbtn', 'Practice offline'), 'big two menu has an offline practice button')
  await p.waitForSelector('.bthand .btcard'); await sleep(1200)
  const n = await p.$$eval('.bthand .btcard', (e) => e.length)
  ok(n === 13, 'you hold 13 cards')
  // when it is our turn, try the cards one by one until one is a legal play (a single, or the opening 3 of diamonds)
  let played = false
  for (let i = 0; i < 60 && !played; i++) {
    const myTurn = await p.evaluate(() => /Your turn|You open|You lead/.test(document.querySelector('.hdmsg')?.textContent || ''))
    if (myTurn) {
      const cards = await p.$$('.bthand .btcard')
      for (const c of cards) {
        await c.click(); await sleep(60)
        const play = await p.$('.hdactions .hdbtn.primary:not(:disabled)')
        if (play) { await play.click(); played = true; break }
        await c.click()
      }
      if (!played) { const pass = await p.$('.hdactions .hdbtn:not(.primary):not(:disabled)'); if (pass) await pass.click() }
    }
    await sleep(300)
  }
  await sleep(500)
  const left = await p.$$eval('.bthand .btcard', (e) => e.length)
  ok(played && left < 13, `a legal play is accepted and leaves ${left} cards in hand`)
  const header = await p.$eval('.hdhead', (e) => e.textContent || '')
  ok(/Practice/.test(header) && !/Copy invite/.test(header), 'practice header has no invite link')
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
