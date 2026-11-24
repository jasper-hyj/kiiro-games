import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/cards/account-shots.ts [outDir]   (local wrangler :8787 + vite :5200)
// Sign-in, create-account and profile dialogs in English, Chinese and Japanese on a small phone: screenshots plus an overflow check.
const out = process.argv[2] || '.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const u = 'sh' + Math.floor(Math.random() * 1e6)
const r = await fetch('http://localhost:8787/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: 'password123' }) })
const { token } = await r.json() as { token: string }
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const overflow = (p: import('puppeteer-core').Page) => p.evaluate(`(() => { const bx = document.querySelector('.acbox'); if (!bx) return 'no dialog'; const r = bx.getBoundingClientRect(); const bad = []; bx.querySelectorAll('*').forEach((e) => { const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) bad.push(e.tagName + '.' + e.className + ':' + (e.textContent || '').slice(0, 20)) }); return bx.scrollWidth > bx.clientWidth + 1 ? 'scrolls sideways' : bad.slice(0, 3).join(' | ') })()`)
for (const lang of ['en', 'zh', 'ja']) {
  for (const signed of [false, true]) {
    const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: 320, height: 640, hasTouch: true, isMobile: true })
    p.on('pageerror', (e) => { fails++; console.log('PAGEERROR', (e as Error).message) })
    await p.evaluateOnNewDocument((l: string, t: string | null) => { localStorage.setItem('kiiro-lang', l); if (t) localStorage.setItem('kiiro-token', t) }, lang, signed ? token : null)
    await p.goto('http://localhost:5200/', { waitUntil: 'networkidle0' }); await p.waitForSelector('.kg-acct'); await sleep(500)
    await p.click('.kg-acct'); await p.waitForSelector('.acbox'); await sleep(300)
    if (!signed) {
      await p.screenshot({ path: `${out}/acct-${lang}-signin.png` }); const o1 = await overflow(p); if (o1) { fails++; console.log('FAIL', lang, 'sign-in', o1) }
      await p.click('.actabs button:nth-child(2)'); await p.type('.acfield input', 'a b'); await sleep(200)
      await p.screenshot({ path: `${out}/acct-${lang}-create.png` }); const o2 = await overflow(p); if (o2) { fails++; console.log('FAIL', lang, 'create', o2) }
    } else {
      await p.screenshot({ path: `${out}/acct-${lang}-profile.png` }); const o3 = await overflow(p); if (o3) { fails++; console.log('FAIL', lang, 'profile', o3) }
    }
    console.log('checked', lang, signed ? 'profile' : 'sign-in + create')
    await p.browserContext().close()
  }
}
await b.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0)
