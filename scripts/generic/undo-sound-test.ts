import puppeteer, { type Page } from 'puppeteer-core'
import { Chess } from '../../src/games/chess/engine'
// Run: npx tsx scripts/generic/undo-sound-test.ts [port]   (vite) Taking moves back (practice and same device, only in games without chance or hidden
// hands), and the table sounds with their mute switch.
const port = process.argv[2] || '5200'
setTimeout(() => {
  console.log('FAIL TIMEOUT')
  process.exit(1)
}, 200000)
let fails = 0
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++
    console.log('FAIL', m)
  } else console.log('ok  ', m)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// the engine: going back keeps people seated and the game running
{
  const g = new Chess().init()
  g.botDelayMs = 600000
  g.turnTimerMs = 0
  g.join('a', 'A')
  g.start('a')
  const first = g.turn()
  const start = g.serialize()
  g.assist(first)
  g.rewind(start)
  ok(g.status === 'playing' && g.turn() === first && g.seats[0].connected, 'engine: rewinding returns the turn and keeps the player seated')
  g.dispose()
}

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const open = async (path: string, ready: string) => {
  const p = await (await b.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true })
  await p.evaluateOnNewDocument(() => localStorage.setItem('kiiro-lang', 'en'))
  p.on('pageerror', (e: unknown) => {
    fails++
    console.log('FAIL page error', (e as Error).message)
  })
  await p.goto(`http://localhost:${port}${path}`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector(ready)
  return p
}
const pieces = (p: Page) => p.$$eval('.chsq', (e) => e.map((x) => x.getAttribute('aria-label')).join(','))
const square = (p: Page, n: string) =>
  p.evaluate((nm) => {
    ;(Array.from(document.querySelectorAll('.chsq')).find((e) => e.getAttribute('aria-label')?.startsWith(nm)) as HTMLElement).click()
  }, n)
const cues = (p: Page) => p.evaluate(() => ((window as unknown as { __cues?: string[] }).__cues ?? []).join(' '))

// practice: my move and the computer's reply are both taken back
{
  const p = await open('/chess/practice', '.chsq')
  await sleep(1500)
  // whichever colour I have, wait for my turn
  for (let i = 0; i < 20 && !(await p.$('.chsq:not(:disabled)')); i++) await sleep(300)
  const before = await pieces(p)
  ok(!(await p.$('.plundo')), 'practice: nothing to undo before I have moved')
  const white = (await p.$eval('.gmside', (e) => e.textContent || '')).includes('You play White')
  await square(p, white ? 'e2' : 'e7')
  await sleep(150)
  await square(p, white ? 'e4' : 'e5')
  await sleep(2500)
  ok((await pieces(p)) !== before && !!(await p.$('.plundo')), 'practice: after moving there is an Undo button')
  ok(/move/.test(await cues(p)) && /turn/.test(await cues(p)), `sound: a move and "your turn" were played (${await cues(p)})`)
  await p.click('.plundo')
  await sleep(1500)
  ok((await pieces(p)) === before, 'practice: Undo puts the board back to before my move')
  ok(!(await p.$('.plundo')) && !!(await p.$('.chsq:not(:disabled)')), 'practice: and it is my turn again')
  // mute: nothing more is played, and the choice is remembered
  await p.click('.k-sound')
  const n = (await cues(p)).length
  await square(p, white ? 'd2' : 'd7')
  await sleep(150)
  await square(p, white ? 'd4' : 'd5')
  await sleep(2000)
  ok((await cues(p)).length === n, 'sound: muted, nothing more is played')
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.k-sound')
  ok((await p.$eval('.k-sound', (e) => e.getAttribute('aria-pressed'))) === 'false', 'sound: the mute switch is remembered')
  await p.browserContext().close()
}
// same device: one move at a time
{
  const p = await open('/gomoku/local', '.gmboard')
  const cells = await p.$$('.gmhit')
  for (const i of [40, 41]) {
    const all = await p.$$('.gmhit')
    await all[i % all.length].click()
    await sleep(200)
    if (await p.$('.gmconfirm .hdbtn.primary')) await p.click('.gmconfirm .hdbtn.primary')
    await sleep(300)
  }
  void cells
  ok((await p.$$('.gmst')).length === 2, 'same device: two stones on the board')
  await p.click('.plundo')
  await sleep(300)
  ok((await p.$$('.gmst')).length === 1, 'same device: Undo takes back one stone')
  await p.click('.plundo')
  await sleep(300)
  ok((await p.$$('.gmst')).length === 0 && !(await p.$('.plundo')), 'same device: and the one before it')
  await p.browserContext().close()
}
// no undo where there is chance or something hidden
for (const g of ['yahtzee', 'hearts']) {
  const p = await open(`/${g}/practice`, '.play')
  await sleep(1200)
  await p.evaluate(() => (document.querySelector('.yzdice .hdbtn, .tkcard.ok') as HTMLElement | null)?.click())
  await sleep(800)
  ok(!(await p.$('.plundo')), `${g}: no Undo`)
  await p.browserContext().close()
}
// the switch is on the other tables too, and fits
for (const path of ['/holdem/practice', '/blackjack/practice', '/bigtwo/practice']) {
  const p = await open(path, '.k-sound')
  await p.setViewport({ width: 320, height: 640, hasTouch: true, isMobile: true })
  await sleep(800)
  const wide = await p.evaluate(() => (document.querySelector('.kg.hd') as HTMLElement).scrollWidth > innerWidth + 1)
  ok(!wide, `${path}: the header with the sound switch fits a 320 px screen`)
  await p.screenshot({ path: `${process.env.OUT ?? '/tmp'}/head${path.replace(/\//g, '-')}.png` })
  await p.browserContext().close()
}
await b.close()
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exit(fails ? 1 : 0)
