import puppeteer from 'puppeteer-core'

/** Against `wrangler dev` + `vite`: the ruleset picked while creating a room is the one the room gets. */
const BASE = process.env.BASE ?? 'http://localhost:5199'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let fails = 0
for (const [index, rule] of [[0, 'taiwan'], [1, 'hk'], [2, 'riichi'], [3, 'mcr'], [4, 'sichuan']] as const) {
  const p = await b.newPage()
  await p.setViewport({ width: 1280, height: 800 })
  await p.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('kiiro-lang', 'en') } catch { /* ignore */ } })
  await p.goto(BASE + '/mahjong', { waitUntil: 'networkidle0' })
  const click = (s: string) => p.evaluate((x: string) => (document.querySelector(x) as HTMLElement | null)?.click(), s)
  await click('.btn.gold.big'); await sleep(500)
  await p.evaluate((i: number) => (document.querySelectorAll('button.rule')[i] as HTMLElement).click(), index); await sleep(500)
  await click('.btn.gold.big'); await sleep(500) // options -> continue
  await click('.btn.gold.big'); await sleep(2500) // name -> create the room
  const got = await p.evaluate(() => document.documentElement.dataset.rule ?? 'none')
  const ok = got === rule
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', `picked ${rule} -> room has ${got}`)
  await p.close()
}
await b.close()
process.exit(fails ? 1 : 0)
