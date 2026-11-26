import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/paper-modal.ts <outDir> [port]   The sign-in dialog and the leaderboard on the hub, to look at the account side of the design.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1100, height: 800 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.kg-acct')
await p.click('.kg-acct')
await new Promise((r) => setTimeout(r, 600))
await p.screenshot({ path: `${out}/modal.png` })
await p.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 300))
await p.evaluate(() => document.querySelector('.kg-board')?.scrollIntoView())
await new Promise((r) => setTimeout(r, 600))
await p.screenshot({ path: `${out}/board.png` })
await b.close()
