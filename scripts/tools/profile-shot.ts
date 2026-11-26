import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/tools/profile-shot.ts <outDir> [port]   The signed-in account chip and profile dialog at phone sizes (the API is faked in the browser, no real account is touched). Reports anything wider than the screen.
const out = process.argv[2] || '.'
const port = process.argv[3] || '5200'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const ME = { id: 'u1', name: 'Jasper the Longname', username: 'jasperlong', balance: 1234567, profit: -48200, level: 12, games: 143, admin: true }
const HIST = Array.from({ length: 10 }, (_, i) => ({
  id: 'm' + i,
  game: 'holdem',
  rule: i % 2 ? "Texas Hold'em" : 'Taiwanese',
  ranked: i % 2,
  at: Date.now() - i * 86400000,
  place: 1 + (i % 4),
  points: 0,
  chips: i % 2 ? -12500 * i : 0,
}))
let problems = 0
for (const [w, h, tag] of [
  [320, 568, 'small'],
  [390, 844, 'phone'],
  [667, 375, 'landscape'],
] as const) {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, hasTouch: true, isMobile: true })
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('kiiro-lang', 'en')
    localStorage.setItem('kiiro-token', 'fake')
  })
  await p.setRequestInterception(true)
  p.on('request', (r) => {
    const u = r.url()
    const json = (o: unknown) =>
      r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) })
    if (r.method() === 'OPTIONS' && u.includes('/api/'))
      return r.respond({
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
      })
    if (/\/api\/me\/matches/.test(u)) return json({ matches: HIST })
    if (/\/api\/me(\?|$)/.test(u)) return json(ME)
    if (/\/api\/leaderboard/.test(u)) return json({ season: '2026-11', rows: [] })
    r.continue()
  })
  await p.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.kg-acct small, .kg-acct', { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 800))
  await p.screenshot({ path: `${out}/profile-${tag}-bar.png` })
  await p.click('.kg-acct')
  await p.waitForSelector('.acbox')
  await new Promise((r) => setTimeout(r, 500))
  await p.screenshot({ path: `${out}/profile-${tag}.png` })
  const r =
    (await p.evaluate(`(() => { const o = []; const iw = innerWidth; const box = document.querySelector('.acbox'); const bq = box.getBoundingClientRect()
    if (box.scrollWidth > box.clientWidth + 1) o.push('dialog scrolls sideways: ' + box.scrollWidth + ' > ' + box.clientWidth)
    if (bq.right > iw + 1 || bq.left < -1) o.push('dialog outside screen')
    for (const e of box.querySelectorAll('*')) { const q = e.getBoundingClientRect(); if (q.width && (q.right > bq.right + 1 || q.left < bq.left - 1)) { o.push((e.className || e.tagName) + ' sticks out of the dialog'); break } }
    for (const e of box.querySelectorAll('button, a, input')) { const q = e.getBoundingClientRect(); if (q.height && q.height < 36) o.push('small tap target: ' + (e.textContent || e.placeholder).slice(0, 20) + ' ' + Math.round(q.height) + 'px') }
    const bar = document.querySelector('.kg-bar').getBoundingClientRect(); o.push('bar height ' + Math.round(bar.height))
    return o })()`)) as string[]
  for (const x of r) {
    if (!x.startsWith('bar height')) problems++
    console.log(`  ${tag}: ${x}`)
  }
  await p.browserContext().close()
}
await b.close()
console.log(problems ? `${problems} things to look at` : 'no problems')
process.exit(0)
