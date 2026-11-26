import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/help-shot.ts out.png   Screenshots the table header of Hold'em practice (back, title, ? button) at a small and a large size.
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 520, height: 700, deviceScaleFactor: 2 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto('http://localhost:5200/holdem/practice', { waitUntil: 'networkidle0' })
await p.waitForSelector('.k-head')
await (await p.$('.k-head'))!.screenshot({ path: process.argv[2] })
await b.close()
