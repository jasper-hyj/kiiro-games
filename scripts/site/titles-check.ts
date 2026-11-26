import puppeteer from 'puppeteer-core'
// Run: npx tsx scripts/site/titles-check.ts   (needs vite on :5200). Every page names itself in the tab title, in every language.
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
let bad = 0
const want: Record<string, string> = {
  '/': 'Kiiro Games',
  '/mahjong': 'Kiiro Mahjong',
  '/holdem': "Texas Hold'em · Kiiro Games",
  '/blackjack': 'Blackjack · Kiiro Games',
  '/bigtwo': 'Big Two · Kiiro Games',
  '/admin': 'Admin · Kiiro Games',
}
for (const lang of ['en', 'zh', 'ja'])
  for (const [path, en] of Object.entries(want)) {
    const p = await (await b.createBrowserContext()).newPage()
    await p.evaluateOnNewDocument((l: string) => localStorage.setItem('kiiro-lang', l), lang)
    await p.goto('http://localhost:5200' + path, { waitUntil: 'networkidle0' })
    const title = await p.title()
    const wrong = lang === 'en' ? title !== en : /Mahjong|麻/.test(title) !== (path === '/mahjong')
    if (wrong) {
      bad++
      console.log('WRONG', lang, path, '->', title)
    } else console.log('ok  ', lang, path, '->', title)
    await p.browserContext().close()
  }
await b.close()
console.log(bad ? `${bad} wrong` : 'all titles ok')
process.exit(bad ? 1 : 0)
