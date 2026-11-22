import puppeteer from 'puppeteer-core'

/** screenshots of the rules reference (all three tabs) in the given language: tsx scripts/shot-rules.ts zh */
const lang = process.argv[2] ?? 'en'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 900, height: 1000, deviceScaleFactor: 1 })
await p.evaluateOnNewDocument((l) => { try { localStorage.setItem('kiiro-lang', l) } catch { /* ignore */ } }, lang)
await p.goto(process.env.BASE ?? 'http://localhost:5199/mahjong', { waitUntil: 'networkidle0' })
await p.evaluate(() => { const el = [...document.querySelectorAll<HTMLElement>('button')].find((e) => /Rules reference|規則說明/.test(e.textContent ?? "")); el?.click() })
await new Promise((r) => setTimeout(r, 300))
const tabs = ['taiwan', 'hk', 'riichi']
for (let i = 0; i < 3; i++) {
  await p.evaluate((i) => { (document.querySelectorAll('.modal .tabs button')[i] as HTMLElement).click() }, i)
  await new Promise((r) => setTimeout(r, 200))
  await p.screenshot({ path: `/tmp/shots/rules-${lang}-${tabs[i]}.png` })
}
await b.close()
