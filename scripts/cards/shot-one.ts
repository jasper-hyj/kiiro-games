import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/shot-one.ts <url-path> <w> <h> <out.png>   (needs vite on :5200)
const [path, w, h, out] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5]]
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: w, height: h, hasTouch: w < 1000, isMobile: w < 1000 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto('http://localhost:5200' + path, { waitUntil: 'networkidle0' })
await p.screenshot({ path: out })
await b.close()
