import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/chat-shot.ts <w> <h> <out.png> [game]   (needs wrangler on :8787 and vite on :5200)
const [w, h, out, game = 'holdem'] = [+process.argv[2], +process.argv[3], process.argv[4], process.argv[5]]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: w, height: h, hasTouch: w < 1000, isMobile: w < 1000 })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto(`http://localhost:5200/${game}`, { waitUntil: 'networkidle0' })
await p.click('.hdform .hdbtn.primary'); await p.waitForSelector('.kgchat'); await sleep(600)
await p.focus('.kgin input')
for (const t of ['gl hf everyone', 'nice hand, that river hurt']) { await p.type('.kgin input', t); await p.keyboard.press('Enter'); await sleep(1200) }
await p.screenshot({ path: out }); await b.close()
