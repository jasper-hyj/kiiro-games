import puppeteer from 'puppeteer-core'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/cards/mj-room-shot.ts <outDir>   Mahjong in the room (rulesets and options) and its table lobby, desktop and phone.
const out = process.argv[2] || '.'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, tag] of (process.env.ONLY === 'phone' ? [[390, 844, 'phone']] : [[1280, 900, 'desk'], [390, 844, 'phone']]) as [number, number, string][]) {
  const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h, hasTouch: w < 700, isMobile: w < 700 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto('http://localhost:5200/room/new?game=mahjong', { waitUntil: 'networkidle0' }); await p.waitForSelector('.rmrulecard'); await new Promise((r) => setTimeout(r, 800))
  await p.click('.rmrulecard[data-rule=riichi]'); await new Promise((r) => setTimeout(r, 500))
  await p.screenshot({ path: `${out}/mj-room-${tag}.png` })
  await p.goto(await tableUrl('mahjong', { rule: 'riichi', rounds: 2, aka: true, players: 4, botLevel: 'normal', coach: true }), { waitUntil: 'networkidle0' }); await p.waitForSelector('.mjtable'); await new Promise((r) => setTimeout(r, 800))
  await p.screenshot({ path: `${out}/mj-lobby-${tag}.png` })
}
await b.close()
