import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/generic/local-test.ts [port]   (vite) Two people on one device: the table is always shown from the seat on turn, and both sides can move in turn.
const port = process.argv[2] || '5200'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const page = async (path: string) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 1000, height: 900 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => { fails++; console.log('PAGEERROR', (e as Error).message) })
  await p.goto(`http://localhost:${port}${path}`, { waitUntil: 'domcontentloaded' })
  return p
}
// Gomoku: tap two points; both stones appear and are different colours
{
  const p = await page('/gomoku/local'); await p.waitForSelector('.gmboard')
  const cells = await p.$$('.gmhit')
  await cells[112].click(); await sleep(200)
  const cells2 = await p.$$('.gmhit'); await cells2[0].click(); await sleep(200)
  const stones = await p.$$eval('.gmst', (e) => e.map((x) => x.getAttribute('class')))
  ok(stones.length === 2 && stones[0] !== stones[1], `gomoku: two people place black and white on one screen (${stones.join(' | ')})`)
  ok(/Player [12].s turn/.test(await p.$eval('.plline', (e) => e.textContent || '')), 'gomoku: the line names whose turn it is')
  ok((await p.$eval('.k-title', (e) => e.textContent || '')).includes('Same device'), 'gomoku: the header says Same device')
}
// Checkers: after red moves it is ivory's turn and the board has not turned round
{
  const p = await page('/checkers/local'); await p.waitForSelector('.ckboard')
  const order = () => p.$$eval('.cksq', (e) => e.map((x) => x.getAttribute('aria-label')).join(';'))
  const before = await order()
  const mover = await p.$$('.cksq.mv')
  await mover[0].click(); await sleep(150)
  const tgt = await p.$('.cksq.tgt'); await tgt!.click(); await sleep(400)
  const now = await p.$eval('.gmchip', (e) => e.textContent || '')
  ok(/Ivory to move/.test(now), `checkers: after red moves it is ivory to move (${now})`)
  ok((await order()) === before, 'checkers: the board keeps its orientation')
}
// Chess: the same
{
  const p = await page('/chess/local'); await p.waitForSelector('.chsq')
  const order = () => p.$$eval('.chsq', (e) => e.map((x) => (x.getAttribute('aria-label') || '').slice(0, 2)).join(''))
  const before = await order()
  const tap = (n: string) => p.evaluate((nm) => { (Array.from(document.querySelectorAll('.chsq')).find((e) => e.getAttribute('aria-label')?.startsWith(nm)) as HTMLElement).click() }, n)
  await tap('e2'); await sleep(150); await tap('e4'); await sleep(400)
  ok(/Black to move/.test(await p.$eval('.gmside', (e) => e.textContent || '')), 'chess: it is black to move')
  ok((await order()) === before, 'chess: the board keeps its orientation')
}
// Xiangqi: red moves a soldier, the pieces stay where they are on screen
{
  const p = await page('/xiangqi/local'); await p.waitForSelector('.xqboard')
  const spots = () => p.$$eval('.xqp', (e) => e.map((x) => `${x.getAttribute('class')?.includes(' r') ? 'r' : 'b'}:${Math.round(x.getBoundingClientRect().top)}`))
  const redLow = (list: string[]) => { const avg = (c: string) => { const ys = list.filter((s) => s.startsWith(c)).map((s) => Number(s.slice(2))); return ys.reduce((a, b) => a + b, 0) / ys.length }; return avg('r') > avg('b') }
  ok(redLow(await spots()), 'xiangqi: red starts at the bottom')
  await p.evaluate(() => { const cells = Array.from(document.querySelectorAll('.xqcell.live')); (cells[0] as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await sleep(200)
  const target = await p.$('.xqtgt'); if (target) { await p.evaluate(() => { const t = document.querySelector('.xqtgt')!; (t.closest('.xqcell') ?? t.parentElement!).dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await sleep(400) }
  ok(redLow(await spots()), 'xiangqi: red is still at the bottom after a move')
}
// the hub offers it only for games with open information
{
  const p = await page('/'); await p.waitForSelector('.kg-obj')
  const out: boolean[] = []
  for (const n of ['Gomoku', "Texas Hold'em"]) {
    await p.evaluate((nm) => { (Array.from(document.querySelectorAll('.kg-obj')).find((e) => e.textContent?.includes(nm)) as HTMLElement).click() }, n)
    await sleep(250)
    out.push(await p.evaluate(() => Array.from(document.querySelectorAll('.kg-practice')).some((e) => e.textContent === 'Same device')))
  }
  ok(out[0] === true && out[1] === false, `hub: Same device appears for Gomoku and not for Hold'em (${out})`)
}
await b.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
