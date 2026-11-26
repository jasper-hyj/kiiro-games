import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { tableUrl } from '../lib/table'
// Run: npx tsx scripts/cards/zh-toggle-test.ts   (wrangler :8787 + vite :5200)
// Switching 简 -> 繁 must leave no Simplified character on screen, on any page or dialog (text, tooltips, placeholders, tab titles).
setTimeout(() => {
  console.log('TIMEOUT')
  process.exit(1)
}, 280000)
const BASE = process.env.BASE ?? 'http://localhost:5200'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const pairs = /const PAIRS = '([^']+)'/.exec(readFileSync('src/simplify.ts', 'utf8'))![1]
const simp = new Set<string>()
for (let i = 0; i < pairs.length; i += 2) if (pairs[i + 1] !== pairs[i]) simp.add(pairs[i + 1])
for (const c of '制台系面云干只表复里后') simp.delete(c) // valid in both scripts
const SIMP = [...simp].join('')
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })

const SCAN = `(() => {
  const S = new Set(${JSON.stringify(SIMP)})
  const bad = []
  const check = (label, t) => { const h = [...new Set([...t].filter((c) => S.has(c)))]; if (h.length) bad.push(label + ': ' + h.join('') + ' <- ' + t.trim().slice(0, 40)) }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = tw.nextNode())) { if (n.parentElement && !n.parentElement.closest('script,style,.tile,svg,.kg-lang,.langsw')) check('text', n.data) }
  for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v) check(a, v) }
  check('document.title', document.title)
  return bad
})()`

const visit = async (label: string, url: string, wait: string, act?: (p: Page) => Promise<void>) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 1100, height: 900 })
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('kiiro-lang', 'zh')
    localStorage.setItem('kiiro-zhs', '1')
  }) // start in Simplified
  await p.goto(url, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector(wait, { timeout: 20000 }).catch(() => {})
  await sleep(600)
  if (act) await act(p)
  const sw = async (which: '简' | '繁') => {
    await p.evaluate((w: string) => {
      const b = Array.from(document.querySelectorAll('.kg-lang button, .langsw button')).find((x) => (x.textContent || '').includes(w)) as
        HTMLElement | undefined
      b?.click()
    }, which)
    await sleep(700)
  }
  const hasSwitch = !!(await p.$('.kg-lang button, .langsw button'))
  const simpScan = (await p.evaluate(SCAN)) as string[]
  if (hasSwitch) await sw('繁')
  else
    await p.evaluate(() => {
      localStorage.setItem('kiiro-zhs', '0')
    })
  if (!hasSwitch) {
    await p.reload({ waitUntil: 'domcontentloaded' })
    await p.waitForSelector(wait, { timeout: 20000 }).catch(() => {})
    await sleep(600)
    if (act) await act(p)
  }
  const trad = (await p.evaluate(SCAN)) as string[]
  void simpScan
  ok(trad.length === 0, `${label}: no Simplified characters after switching to Traditional${trad.length ? ' -> ' + trad.slice(0, 4).join(' | ') : ''}`)
  await p.browserContext().close()
}

await visit('hub', BASE + '/', '.kg-table')
await visit('hub, a game picked', BASE + '/', '.kg-table', async (p) => {
  await p.click('.kg-obj:nth-child(2)')
  await sleep(300)
})
await visit('hub sign-in dialog', BASE + '/', '.kg-table', async (p) => {
  await p.click('.kg-acct')
  await p.waitForSelector('.acbox')
  await sleep(300)
})
await visit('hub create-account dialog', BASE + '/', '.kg-table', async (p) => {
  await p.click('.kg-acct')
  await p.waitForSelector('.actabs')
  await p.click('.actabs button:nth-child(2)')
  await sleep(300)
})
await visit('room landing', BASE + '/room', '.rmentry')
await visit('room', BASE + '/room/new?game=holdem', '.rmpeople', async (p) => {
  await sleep(600)
})
await visit('hold’em practice', BASE + '/holdem/practice', '.hd-actions')
await visit('hold’em help', BASE + '/holdem/practice', '.hd-actions', async (p) => {
  await p.click('.k-helpbtn')
  await sleep(300)
})
await visit('blackjack practice', BASE + '/blackjack/practice', '.bjchips')
await visit('blackjack help', BASE + '/blackjack/practice', '.bjchips', async (p) => {
  await p.click('.k-helpbtn')
  await sleep(300)
})
await visit('big two practice', BASE + '/bigtwo/practice', '.bthand .btcard')
await visit('big two help', BASE + '/bigtwo/practice', '.bthand .btcard', async (p) => {
  await p.click('.k-helpbtn')
  await sleep(300)
})
await visit('big two lobby', await tableUrl('bigtwo', {}), '.btlobby')
await visit('mahjong practice', BASE + '/mahjong/practice', '.handrow .tile')
await visit('mahjong rules reference', BASE + '/mahjong/practice', '.handrow .tile', async (p) => {
  await p.evaluate(() => {
    ;(document.querySelector('.rulesbtn') as HTMLElement | null)?.click()
  })
  await sleep(500)
})
await visit('mahjong table lobby', await tableUrl('mahjong', { rule: 'riichi' }), '.roomtag, .seatcard, .lobby')
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
