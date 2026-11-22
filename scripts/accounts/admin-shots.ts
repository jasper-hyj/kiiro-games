import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/accounts/admin-shots.ts <outDir>   (needs wrangler on :8787 with ADMIN_USERS=shotdesk, vite on :5200)
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const login = await (await fetch('http://localhost:8787/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'shotdesk', password: 'test-password-1' }) })).json() as { token: string }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h, tag] of [[1280, 800, 'desk'], [390, 844, 'phone']] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: tag === 'phone', isMobile: tag === 'phone' })
  await p.evaluateOnNewDocument((t: string) => { localStorage.setItem('kiiro-lang', 'en'); localStorage.setItem('kiiro-token', t) }, login.token)
  p.on('pageerror', (e: unknown) => console.log(tag, 'pageerror', (e as Error).message))
  await p.goto('http://localhost:5200/admin', { waitUntil: 'networkidle0' }); await sleep(600)
  for (const tab of ['overview', 'users', 'matches', 'ledger', 'audit']) {
    await p.evaluate((x: string) => { const el = Array.from(document.querySelectorAll('.adtabs button')).find((e) => e.textContent === x) as HTMLElement | undefined; el?.click() }, tab)
    await sleep(500); await p.screenshot({ path: `${out}/adm-${tab}-${tag}.png` })
  }
  await p.browserContext().close()
}
await b.close()
