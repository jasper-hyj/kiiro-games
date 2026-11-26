import puppeteer, { type Page } from 'puppeteer-core'
// Run: npx tsx scripts/tools/mahjong-shots.ts <outDir> [port]   (vite) Mahjong's dialogs on a desktop and a phone: the table menu, the rules reference and the guide.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const click = (p: Page, sel: string) => p.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel)
for (const [w, h, tag] of [
  [1100, 760, 'desk'],
  [390, 844, 'phone'],
] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  await p.goto(`http://localhost:${port}/mahjong/practice?stress=full&players=4&rule=riichi`, { waitUntil: 'domcontentloaded' })
  await sleep(1500)
  await click(p, '.dock summary')
  await sleep(400)
  await p.screenshot({ path: `${out}/mj-menu-${tag}.png` })
  await click(p, '.dockpanel .rulesbtn')
  await sleep(700)
  await p.screenshot({ path: `${out}/mj-rules-${tag}.png` })
  await p.goto(`http://localhost:${port}/mahjong/tutorial`, { waitUntil: 'domcontentloaded' })
  await sleep(1800)
  await p.screenshot({ path: `${out}/mj-guide-${tag}.png` })
  await p.browserContext().close()
}
await b.close()
