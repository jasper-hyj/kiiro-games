import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/modals-shot.ts <outDir>   (needs wrangler on :8787 with ADMIN_USERS=shotdesk, vite on :5200)
setTimeout(() => process.exit(1), 100000)
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const login = (await (await fetch('http://localhost:8787/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'shotdesk', password: 'test-password-1' }) })).json()) as { token?: string }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
for (const [lang, tag] of [['en', 'en'], ['ja', 'ja']] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
  await p.evaluateOnNewDocument((l: string) => localStorage.setItem('kiiro-lang', l), lang)
  await p.goto('http://localhost:5200/', { waitUntil: 'networkidle0' })
  await p.click('.kg-acct'); await sleep(500); await p.screenshot({ path: `${out}/m-signin-${tag}.png` })
  await p.keyboard.press('Escape'); await p.mouse.click(5, 5)
  if (login.token && tag === 'en') {
    await p.evaluate((t: string) => localStorage.setItem('kiiro-token', t), login.token); await p.goto('http://localhost:5200/', { waitUntil: 'networkidle0' }); await sleep(600)
    await p.click('.kg-acct'); await sleep(600); await p.screenshot({ path: `${out}/m-profile-${tag}.png` })
    await p.goto('http://localhost:5200/admin', { waitUntil: 'networkidle0' }); await sleep(900); await p.screenshot({ path: `${out}/m-admin-${tag}.png` })
  }
  await p.browserContext().close()
}
await b.close(); process.exit(0)
