import puppeteer from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/cards/reconnect-test.ts   (wrangler :8787 + vite :5200)
// A connection that drops mid-game comes back by itself: a 1 s blip is never shown, a longer outage shows "connection lost" and then heals,
// and the player gets the same seat and hand back (no bot takes over, no reload needed).
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 200000)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m) } else console.log('ok  ', m) }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1100, height: 800 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
p.on('pageerror', (e: unknown) => { fails++; console.log('PAGEERROR', (e as Error).message) })
const cdp = await p.createCDPSession()
await cdp.send('Network.enable')
const offline = (on: boolean) => cdp.send('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
const cut = async () => { // really drop the socket (offline mode alone leaves an open socket alone): close it from the page, then block the network
  await p.evaluate(() => { for (const ws of (window as any).__sockets ?? []) try { ws.close() } catch { /* ignore */ } })
}
await p.evaluateOnNewDocument(() => { // remember every WebSocket the page opens
  const W = window.WebSocket; (window as any).__sockets = []
  ;(window as any).WebSocket = class extends W { constructor(u: string | URL, pr?: string | string[]) { super(u, pr); (window as any).__sockets.push(this) } }
})
await p.goto(await tableUrl('bigtwo', {}), { waitUntil: 'networkidle0' })
await p.waitForSelector('.hdform .hdbtn.primary, .bthand .btcard'); if (await p.$('.hdform .hdbtn.primary')) await p.click('.hdform .hdbtn.primary'); await p.waitForSelector('.bthand .btcard')
const cards = async () => p.$$eval('.bthand .btcard', (e) => e.length)
const lost = async () => p.$$eval('.k-pill.warn', (e) => e.map((x) => x.textContent || '').join('|'))
const n0 = await cards()
ok(n0 === 13, `in the game with 13 cards (${n0})`)

// 1. a short blip: the socket drops and comes straight back
await offline(true); await cut(); await sleep(900); await offline(false); await sleep(2500)
ok(!(await lost()), `a 1 s blip shows no "connection lost" (${await lost() || 'nothing shown'})`)
ok((await cards()) === n0, 'and the hand is still there')

// 2. a longer outage: the banner appears, then heals
await offline(true); await cut(); const seen: string[] = []; for (let i = 0; i < 11; i++) { await sleep(500); seen.push(await lost() || '-') }; console.log('  banner over time:', seen.join(' , '))
ok(/lost|Reconnecting|Connecting/i.test(await lost()), `a 5 s outage says so (${await lost()})`)
await offline(false); await sleep(5000)
ok(!(await lost()), 'and the banner is gone once the network is back')
ok((await cards()) === n0, 'the same 13 cards are back, no reload needed')
const seated = await p.evaluate(() => !!document.querySelector('.bthand .btcard') && !/watching/i.test(document.body.innerText))
ok(seated, 'still seated (a bot did not take the seat)')

// 3. a dead link that still says "open": the page must notice by itself (nothing arrives for a long time)
await offline(true); await sleep(26000)
ok(/lost|Reconnecting|Connecting/i.test(await lost()), `a silent link is noticed (${await lost() || 'nothing shown'})`)
await offline(false); await sleep(6000)
ok(!(await lost()) && (await cards()) >= 1, 'and recovers when the network returns')
await b.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
