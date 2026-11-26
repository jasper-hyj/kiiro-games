import puppeteer from 'puppeteer-core'

/** Pointing at a tile with a mouse lights up every tile of the same kind on the table; moving away clears it. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 900 })
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('kiiro-lang', 'en')
  ;(window as any).__name = (f: unknown) => f
})
await p.goto('http://localhost:5200/?stress=full&players=4&rule=riichi', { waitUntil: 'networkidle0' })
await sleep(800)
let fails = 0
const check = (n: string, ok: boolean, x = '') => {
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', n, x)
}
const hl = () => p.evaluate(() => document.querySelectorAll('.gamecol .tile.hl').length)
check('nothing highlighted at rest', (await hl()) === 0)
const box = await p.evaluate(() => {
  const t = document.querySelector('.handrow .tile[data-kind]') as HTMLElement
  const r = t.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, kind: t.dataset.kind }
})
await p.mouse.move(box.x, box.y)
await sleep(300)
const n = await hl()
const same = await p.evaluate((k: string) => document.querySelectorAll(`.gamecol .tile[data-kind="${k}"]`).length, box.kind!)
check(`hovering a hand tile lights every tile of that kind (${n} of ${same})`, n >= 1 && n === same)
await p.mouse.move(5, 5)
await sleep(300)
check('moving away clears it', (await hl()) === 0)
// call buttons show no tile pictures; pointing at one lights up the tiles it would use
await p.goto('http://localhost:5200/?stress=call&players=4&rule=taiwan', { waitUntil: 'networkidle0' })
await sleep(800)
check('call buttons carry no tile pictures', (await p.evaluate(() => document.querySelectorAll('.actionpop .cbtn .mini').length)) === 0)
const callBtns = await p.$$('.actionpop .cbtn.call')
check('there are call buttons to test', callBtns.length > 0)
for (const btn of callBtns) {
  const label = await btn.evaluate((e) => (e as HTMLElement).innerText.split(/\s+/).join(' ').trim())
  await btn.hover()
  await sleep(250)
  const lit = await p.evaluate(() => ({
    hand: document.querySelectorAll('.handrow .tile.callhl').length,
    river: document.querySelectorAll('.pond .tile.callhl').length,
  }))
  check(`hovering "${label}" lights tiles in the hand (${lit.hand}) and the discard (${lit.river})`, lit.hand >= 1)
}
await p.mouse.move(5, 5)
await sleep(250)
check('moving away clears the call highlight', (await p.evaluate(() => document.querySelectorAll('.tile.callhl').length)) === 0)
await b.close()
process.exit(fails ? 1 : 0)
