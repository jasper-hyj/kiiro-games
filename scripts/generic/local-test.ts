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
  ok((await p.$eval('.plline', (e) => e.textContent || '')).includes('Your turn'), 'gomoku: the line always says it is the viewer\'s turn')
  ok((await p.$eval('.k-title', (e) => e.textContent || '')).includes('Same device'), 'gomoku: the header says Same device')
}
// Checkers: red moves, then the table is shown for ivory
{
  const p = await page('/checkers/local'); await p.waitForSelector('.ckboard')
  const mover = await p.$$('.cksq.mv')
  await mover[0].click(); await sleep(150)
  const tgt = await p.$('.cksq.tgt'); await tgt!.click(); await sleep(400)
  const youNow = await p.$eval('.gmchip', (e) => e.textContent || '')
  ok(/Ivory/.test(youNow), `checkers: after red moves the table is shown for ivory (${youNow})`)
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
