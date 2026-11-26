import puppeteer from 'puppeteer-core'

/** dragging a hand tile upward discards it; a short drag does not */
const BASE = process.env.BASE ?? 'http://localhost:5199'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (n: string, ok: boolean) => {
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', n)
}
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1280, height: 800 })
await p.goto(`${BASE}/?solo=1&rule=taiwan&speed=0.05`, { waitUntil: 'networkidle0' })
await p.waitForSelector('.handrow .tile.clickable', { timeout: 20000 })
const pond = () => p.$$eval('.pond.p0 .tile', (e) => e.length)
const before = await pond()
const center = async () => {
  const t = (await p.$$('.handrow .tile.clickable'))[3]
  const bb = (await t.boundingBox())!
  return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }
}
let c = await center()
await p.mouse.move(c.x, c.y)
await p.mouse.down()
await p.mouse.move(c.x, c.y - 15, { steps: 3 })
await p.mouse.up()
await sleep(300)
check('a short drag does not discard', (await pond()) === before)
await sleep(200)
await p.waitForSelector('.handrow .tile.clickable')
c = await center()
await p.mouse.move(c.x, c.y)
await p.mouse.down()
await p.mouse.move(c.x, c.y - 90, { steps: 6 })
await p.mouse.up()
await sleep(900)
console.log('pond', before, await pond(), await p.$$eval('.handrow .tile', (e) => e.length))
check('dragging a tile up discards it', (await pond()) === before + 1)
await b.close()
console.log(fails ? `\n${fails} FAILED` : '\nflick discard ok')
process.exit(fails ? 1 : 0)
