import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/room-e2e.ts   (needs wrangler dev on :8787 and vite on :5200)
// Two browsers: one creates a room from the hub and picks a game with rules, the other joins by code and chooses to watch or play; the host starts.
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 170000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const BASE = process.env.BASE ?? 'http://localhost:5200'
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const page = async () => { const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 800 }); await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en')); p.on('pageerror', (e: unknown) => { fails++; console.log('pageerror', (e as Error).message) }); return p }
const clickText = (p: any, sel: string, text: string) => p.evaluate((s: string, t: string) => { const el = Array.from(document.querySelectorAll(s)).find((e) => (e.textContent || '').trim().includes(t)) as HTMLElement | undefined; el?.click(); return !!el }, sel, text)

for (const [game, label, rules, expectPath, readySel] of [
  ['holdem', "Texas Hold'em", async (p: any) => { await p.select('.rmrules select', '50/100') }, '/holdem', '.hdfelt'],
  ['blackjack', 'Blackjack', async (p: any) => { await p.select('.rmrules select', '20') }, '/blackjack', '.bjtable'],
  ['bigtwo', 'Big Two', async () => {}, '/bigtwo', '.btlobby'],
  ['mahjong', 'Kiiro Mahjong', async (p: any) => { await p.select('.rmrules select', 'riichi') }, '/mahjong', '.roomtag, .seatcard, .lobby, .page'],
] as const) {
  const host = await page(); const guest = await page()
  await host.goto(BASE + '/', { waitUntil: 'networkidle0' })
  await host.click('a.kg-create'); await host.waitForSelector('.rm, .hdform', { timeout: 15000 })
  ok(new URL(host.url()).pathname === '/room', `${game}: "Create a room" on the hub opens the room page`)
  await host.waitForSelector('.rmpeople', { timeout: 15000 })
  const code = new URL(host.url()).searchParams.get('room')!
  // the guest joins from the hub's code box
  await guest.goto(BASE + '/', { waitUntil: 'networkidle0' })
  await guest.type('#kgcode', code); await guest.click('.kg-join button'); await guest.waitForSelector('.rmpeople', { timeout: 15000 })
  await sleep(500)
  ok((await host.$$eval('.rmpeople li', (e) => e.length)) === 2, `${game}: both people appear in the room`)
  ok(await guest.$('.rmgames') === null, `${game}: only the host sees the game chooser`)
  await clickText(host, '.rmgame', label); await sleep(500)
  await rules(host); await sleep(500)
  const summary = await guest.$eval('.rm', (e) => e.textContent || '')
  ok(summary.includes(label), `${game}: the guest sees the chosen game live`)
  await clickText(guest, '.rmmode button', 'I will watch'); await sleep(400)
  ok((await host.$eval('.rmpeople', (e) => e.textContent || '')).includes('Watching'), `${game}: the host sees the guest chose to watch`)
  await guest.focus('.kgin input'); await guest.type('.kgin input', 'hello room'); await guest.keyboard.press('Enter'); await sleep(700)
  ok((await host.$eval('.kgchat', (e) => e.textContent || '')).includes('hello room'), `${game}: room chat reaches the host`)
  await clickText(host, '.rmstart button', 'Start'); await sleep(3500)
  const hp = new URL(host.url()), gp = new URL(guest.url())
  ok(hp.pathname === expectPath && hp.searchParams.get('room') === code, `${game}: the host lands on the table with the same code (${hp.pathname}${hp.search})`)
  ok(gp.pathname === expectPath && gp.searchParams.get('room') === code && gp.searchParams.get('watch') === '1', `${game}: the guest lands on the same table as a watcher`)
  ok((await host.$(readySel)) !== null && (await guest.$(readySel)) !== null, `${game}: both pages show the table`)
  const err = await guest.evaluate(() => (document.querySelector('.acerr')?.textContent || ''))
  ok(!/not found|cannot|full/i.test(err), `${game}: no error on the guest page (${err.slice(0, 40)})`)
  // back to the room keeps people and chat
  await clickText(host, '.hdlink, .btn, button', 'Back to room')
  await sleep(2500)
  ok(new URL(host.url()).pathname === '/room', `${game}: "Back to room" returns to the room page`)
  await host.browserContext().close(); await guest.browserContext().close()
}
await b.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
