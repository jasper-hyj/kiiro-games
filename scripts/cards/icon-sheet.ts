import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/icon-sheet.ts <outDir> [port]   The twelve game icons, big, on the hub shelf.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1000, height: 800, deviceScaleFactor: 2.2 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' })
await p.waitForSelector('.kg-shelf')
const el = await p.$('.kg-shelf')
await el!.screenshot({ path: `${out}/icons.png` })
await b.close()
