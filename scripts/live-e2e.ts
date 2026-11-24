import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/live-e2e.ts <outDir> [site]   Browser smoke test of the deployed site: hub, create a room, pick a game, start it, land on the table. Guests only: nothing is saved to accounts.
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 240000)
const out = process.argv[2] || '.'
const site = process.argv[3] || 'https://games.jasperhuang.me'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
const errors: string[] = []
p.on('pageerror', (e: unknown) => errors.push((e as Error).message))
p.on('requestfailed', (r) => { if (!/fonts\.g|gstatic|google/.test(r.url())) errors.push('request failed: ' + r.url().slice(0, 90)) })
await p.goto(site + '/', { waitUntil: 'networkidle0' })
ok(/Kiiro Games/.test(await p.title()), `hub title: ${await p.title()}`)
await p.screenshot({ path: `${out}/live-hub.png` })
await p.click('a.kg-create'); await p.waitForSelector('.rmpeople', { timeout: 20000 }).catch(() => {})
ok(!!(await p.$('.rmpeople')), 'Create a room opens a room and connects to the server')
await sleep(800); await p.screenshot({ path: `${out}/live-room.png` })
for (const [label, sel] of [['Texas', '.hdfelt'], ['Big Two', '.btlobby'], ['Blackjack', '.bjtable'], ['Gomoku', '.btlobby'], ['Chess', '.btlobby']] as const) {
  await p.evaluate((l: string) => { const el = Array.from(document.querySelectorAll('.rmgame')).find((e) => (e.textContent || '').includes(l)) as HTMLElement | undefined; el?.click() }, label); await sleep(500)
  await p.evaluate(() => { const el = document.querySelector('.rmstart button') as HTMLElement | null; el?.click() }); await p.waitForSelector(sel, { timeout: 20000 }).catch(() => {}); await sleep(500)
  ok(!!(await p.$(sel)), `${label}: starting from the room lands on a working table (${new URL(p.url()).pathname})`)
  await p.screenshot({ path: `${out}/live-${label.replace(' ', '')}.png` })
  await p.evaluate(() => { const el = Array.from(document.querySelectorAll('button')).find((e) => /Back to room/.test(e.textContent || '')) as HTMLElement | undefined; el?.click() }); await p.waitForFunction(() => /^\/room\/\d{4}$/.test(location.pathname), { timeout: 15000 }).catch(() => {}); await p.waitForSelector('.rmgames', { timeout: 15000 }).catch(() => {}); await sleep(900) // the room has to be connected before the next game is picked
  ok(/^\/room\/\d{4}$/.test(new URL(p.url()).pathname), `${label}: back to room works (${new URL(p.url()).pathname})`)
}
ok(errors.length === 0, `no page errors (${errors.slice(0, 2).join(' | ')})`)
await b.close(); console.log(fails ? `${fails} FAILED` : 'live site ok'); process.exit(fails ? 1 : 0)
