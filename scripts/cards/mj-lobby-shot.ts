import puppeteer from 'puppeteer-core'
import { makeTable } from '../lib/table'
// Run: npx tsx scripts/cards/mj-lobby-shot.ts <outDir> [port]   (wrangler :8787 + vite) The Mahjong table's waiting lobby on a phone, to check it reads well.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const code = await makeTable('mahjong', { rule: 'taiwan' }, undefined, 2)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
await p.goto(`http://localhost:${port}/mahjong/${code}`, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 2500))
await p.screenshot({ path: `${out}/mj-lobby.png` })
await b.close(); process.exit(0)
