import puppeteer, { type Page } from 'puppeteer-core'

const BASE = process.env.BASE ?? 'http://localhost:5199'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
let fails = 0
const check = (n: string, ok: boolean, extra = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const text = (p: Page) => p.evaluate(() => document.body.innerText)

async function hostCreate(p: any) {
  await p.evaluate(() => (document.querySelector('.btn.gold') as HTMLElement).click())   // Play with friends
  await p.waitForSelector('button.rule')
  await p.evaluate(() => (document.querySelector('button.rule') as HTMLElement).click())  // pick Taiwanese
  await p.waitForSelector('input.bigname')
  await p.evaluate(() => (document.querySelector('.btn.gold') as HTMLElement).click())   // Create room
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    const mk = async () => {
      const ctx = await browser.createBrowserContext()
      const p = await ctx.newPage()
      await p.setViewport({ width: 1100, height: 800 })
      await p.evaluateOnNewDocument(() => { try { localStorage.setItem('kiiro-lang', 'en') } catch { /* ignore */ } })
      p.on('pageerror', (e) => { fails++; console.log('FAIL pageerror', String(e).slice(0, 160)) })
      return p
    }
    const host = await mk()
    await host.goto(BASE + '/mahjong', { waitUntil: 'networkidle0' })
    await hostCreate(host)
    await host.waitForSelector('.copyrow input[readonly]')
    const link = await host.$eval('.copyrow input[readonly]', (e) => (e as HTMLInputElement).value)
    const guests: Page[] = []
    for (let i = 0; i < 3; i++) {
      const g = await mk()
      await g.goto(link, { waitUntil: 'networkidle0' })
      await g.type('#nick', 'G' + i)
      await g.keyboard.press('Enter')
      await g.waitForSelector('.seatlist')
      guests.push(g)
    }
    await sleep(500)
    check('four humans fill the room', ((await text(host)).match(/Human/g) ?? []).length === 4)
    const late = await mk()
    await late.goto(link, { waitUntil: 'networkidle0' })
    await late.type('#nick', 'Late')
    await late.keyboard.press('Enter')
    await sleep(1200)
    const t = await text(late)
    check('fifth player gets a clear "room is full" screen', /Can't join this room/.test(t) && /full/.test(t), t.slice(0, 120))
    check('…with a way back to the menu', (await late.$('.joinpage .btn.big')) !== null)
    await late.evaluate(() => (document.querySelector('.joinpage .btn.big') as HTMLElement).click())
    await sleep(300)
    check('back button returns to the main menu', /Play vs bots/i.test(await text(late)))
    check('the full room itself is unaffected', ((await text(host)).match(/Human/g) ?? []).length === 4)
  } finally {
    await browser.close()
  }
  console.log(fails ? `\n${fails} FAILED` : '\nroom-full flow ok')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
