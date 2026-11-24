import puppeteer from 'puppeteer-core'
import { tableUrl } from '../lib/table'
const MK = (g: string, cfg: object, room?: string) => tableUrl(g, cfg, room) // a real table, made through its room (see scripts/lib/table.ts)
// Run: npx tsx scripts/cards/shot-bt-lobby.ts <w> <h> <out.png>   (needs wrangler on :8787 and vite on :5200)
const [w, h, out] = [+process.argv[2], +process.argv[3], process.argv[4]]
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: w, height: h, hasTouch: true, isMobile: true })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto('http://localhost:5200/bigtwo', { waitUntil: 'networkidle0' })
await p.goto(await MK('bigtwo', {})); await p.waitForSelector('.btlobby'); await new Promise((r) => setTimeout(r, 800))
await p.screenshot({ path: out }); await b.close()
