import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/overflow.ts <path-with-query> <w> <h>   Lists the elements that stick out past the right edge of the screen.
setTimeout(() => process.exit(1), 60000)
const [url, w, h] = [process.argv[2], +process.argv[3], +process.argv[4]]
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: w, height: h, hasTouch: true, isMobile: true })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto('http://localhost:5200' + url, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 2500))
console.log(await p.evaluate(`(() => Array.from(document.querySelectorAll('.kg *')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 }).slice(0, 8).map((e) => e.tagName + '.' + String(e.className).slice(0, 40) + ' right=' + Math.round(e.getBoundingClientRect().right)).join('\\n'))()`))
await b.close(); process.exit(0)
