import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/icon-shot.ts out.png [index]   Screenshots one hub card (0 mahjong, 1 holdem, 2 blackjack, 3 big two).
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1100, height: 900, deviceScaleFactor: 2 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto('http://localhost:5200/', { waitUntil: 'networkidle0' })
const cards = await p.$$('svg[viewBox="0 0 64 48"]')
const el = await cards[Number(process.argv[3] ?? 3)].evaluateHandle((e) => e.parentElement!.parentElement!)
await (el.asElement() as any).screenshot({ path: process.argv[2] })
await b.close()
