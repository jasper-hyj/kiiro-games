import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/mahjong/playthrough.ts [phone]   (needs vite on :5200; practice mode runs in the browser)
// Plays a whole practice game through the real UI: discard (tap a tile twice), win when offered, pass on calls, next hand, until the final standings.
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 570000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const phone = process.argv[2] === 'phone'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport(phone ? { width: 390, height: 844, hasTouch: true, isMobile: true } : { width: 1280, height: 780 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en'); localStorage.setItem('kiiro-config', JSON.stringify({ rule: 'taiwan', aka: true, rounds: 1, minFan: 3, players: 4, botLevel: 'easy', coach: true })) })
p.on('pageerror', (e: unknown) => { fails++; console.log('PAGEERROR', (e as Error).message) })
await p.goto('http://localhost:5200/mahjong?solo=1', { waitUntil: 'networkidle0' })
await p.waitForSelector('.handrow .tile', { timeout: 20000 })
let discards = 0, hands = 0, passes = 0, wins = 0, done = false
const t0 = Date.now()
const click = (sel: string) => p.evaluate((s: string) => { const e = document.querySelector(s) as HTMLElement | null; if (e && !(e as HTMLButtonElement).disabled) { e.click(); return true } return false }, sel)
let lastLog = 0
while (Date.now() - t0 < 540000 && !done) {
  if (Date.now() - lastLog > 60000) { lastLog = Date.now(); const m = await p.evaluate(() => (document.querySelector('.overlay .modal')?.textContent || '').replace(/\s+/g, ' ').slice(0, 90)); console.log(`  ${Math.round((Date.now() - t0) / 1000)}s: ${hands} hands, ${discards} discards, modal: ${m || '-'}`) }
  if (await p.$('.overlay .podium')) { done = true; break }
  if (await click('.overlay .modal .btn.gold')) { hands++; await sleep(500); continue }
  if (await click('.apbtns .cbtn.ron')) { wins++; await sleep(600); continue }
  if (await click('.apbtns .cbtn.pass')) { passes++; await sleep(300); continue }
  const tiles = await p.$$('.handrow.mine .tile.clickable, .handrow .tile.clickable')
  if (tiles.length) {
    const t = tiles[tiles.length - 1]
    try { await t.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' })); await t.click(); await sleep(120); await t.click(); discards++ } catch { /* the tile moved: try again */ }
    await sleep(350)
    continue
  }
  await sleep(300)
}
if (!done) { await p.screenshot({ path: `${process.env.OUT || '.'}/mj-stuck.png` }); console.log((await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300)) }
ok(done, `the game reached the final standings (${hands} hands, ${discards} discards, ${passes} passes, ${wins} wins taken)`)
if (done) {
  const standings = await p.$$eval('.podium .pd', (e) => e.map((x) => x.textContent || ''))
  ok(standings.length === 4, `four players are ranked (${standings.length})`)
  await p.screenshot({ path: `${process.env.OUT || '.'}/mj-final-${phone ? 'phone' : 'desk'}.png` })
  ok(!!(await p.$('.overlay .modal .btn')), 'the final dialog has buttons to continue')
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
