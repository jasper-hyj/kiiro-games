import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/accounts/ui-shots.ts <outDir> [port]   (needs wrangler dev on :8787 and vite running)
const out = process.argv[2] || '.', port = process.argv[3] || '5200'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const base = `http://localhost:${port}`
let bad = 0
for (const [w, h, tag] of [[1280, 720, 'desk'], [390, 760, 'phone'], [844, 390, 'land'], [820, 1180, 'tab']] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: tag !== 'desk', isMobile: tag !== 'desk' })
  await p.evaluateOnNewDocument(() => { localStorage.setItem('kiiro-lang', 'en') })
  p.on('pageerror', (e: unknown) => { bad++; console.log('pageerror', (e as Error).message) })
  await p.goto(base + '/', { waitUntil: 'networkidle0' }); await sleep(300)
  await p.screenshot({ path: `${out}/hub-${tag}.png` })
  await p.click('.kg-acct'); await sleep(300)
  await p.screenshot({ path: `${out}/signin-${tag}.png` })
  // create an account through the form (reuse it on later runs)
  const u = `shot${tag}`
  await p.type('.acbox input[autocomplete=username]', u)
  await p.type('.acbox input[type=password]', 'test-password-1')
  await p.click('.acbox .primary'); await sleep(900)
  if (await p.$('.acbox .acerr')) {
    await p.click('.acbox .ghost'); await sleep(200) // switch to "have an account"
    await p.click('.acbox .acstack .primary'); await sleep(900)
  }
  await sleep(300)
  await p.screenshot({ path: `${out}/hub-in-${tag}.png` })
  await p.click('.kg-acct'); await sleep(400)
  await p.screenshot({ path: `${out}/profile-${tag}.png` })
  await p.keyboard.press('Escape'); await p.mouse.click(5, h - 5); await sleep(200)
  await p.goto(base + '/admin', { waitUntil: 'networkidle0' }); await sleep(500)
  await p.screenshot({ path: `${out}/admin-${tag}.png` })
  await p.goto(base + '/mahjong', { waitUntil: 'networkidle0' }); await sleep(400)
  await p.screenshot({ path: `${out}/mahjong-${tag}.png` })
  // overflow check
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  if (ov) { bad++; console.log('horizontal overflow on', tag) }
  await p.close()
}
await b.close()
console.log(bad ? 'problems: ' + bad : 'ui ok')
