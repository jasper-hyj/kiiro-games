import puppeteer, { type Page } from 'puppeteer-core'

const BASE = process.env.BASE ?? 'http://localhost:5199'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
let fails = 0
const check = (n: string, ok: boolean, extra = '') => {
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : extra)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const text = (p: Page) => p.evaluate(() => document.body.innerText)
const pond = (p: Page, cls: string) => p.$$eval(`.pond.${cls} .tile`, (e) => e.length)
const dropConn = (p: Page, ms: number) => p.evaluate((m) => (window as unknown as { __kiiroConn: { drop(ms: number): void } }).__kiiroConn.drop(m), ms)

/** the guest plays every turn it gets (so the table keeps moving) until `stop()` */
function autoPlay(p: Page, label: string) {
  let on = true
  const loop = (async () => {
    while (on) {
      try {
        if (await p.$('.cbtn.pass')) await p.evaluate(() => (document.querySelector('.cbtn.pass') as HTMLElement).click())
        else {
          const tiles = await p.$$('.handrow .tile.clickable')
          if (tiles.length) {
            const b = await tiles[tiles.length - 1].boundingBox()
            if (b) {
              await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
              await sleep(80)
              const s = await p.$('.handrow .tile.sel')
              const sb = s && (await s.boundingBox())
              if (sb) await p.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2)
            }
          }
        }
      } catch {
        /* page navigating */
      }
      await sleep(250)
    }
  })()
  void label
  return {
    stop: async () => {
      on = false
      await loop
    },
  }
}

async function hostCreate(p: any) {
  await p.evaluate(() => (document.querySelector('.btn.gold') as HTMLElement).click()) // Play with friends
  await p.waitForSelector('button.rule')
  await p.evaluate(() => (document.querySelector('button.rule') as HTMLElement).click()) // pick Taiwanese
  await p.waitForSelector('input.bigname')
  await p.evaluate(() => (document.querySelector('.btn.gold') as HTMLElement).click()) // Create room
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    const mk = async () => {
      const ctx = await browser.createBrowserContext()
      const p = await ctx.newPage()
      await p.setViewport({ width: 1280, height: 800 })
      await p.evaluateOnNewDocument(() => {
        try {
          localStorage.setItem('kiiro-lang', 'en')
        } catch {
          /* ignore */
        }
      })
      p.on('pageerror', (e) => {
        fails++
        console.log('FAIL pageerror', String(e).slice(0, 160))
      })
      return p
    }
    const host = await mk()
    await host.goto(BASE + '/?debug=1', { waitUntil: 'networkidle0' })
    await hostCreate(host)
    await host.waitForSelector('.copyrow input[readonly]')
    const link = (await host.$eval('.copyrow input[readonly]', (e) => (e as HTMLInputElement).value)) + '&debug=1'
    const guest = await mk()
    await guest.goto(link, { waitUntil: 'networkidle0' })
    await guest.type('#nick', 'Bob')
    await guest.keyboard.press('Enter')
    await guest.waitForSelector('.seatlist')
    await host.evaluate(() => (document.querySelector('.btn.gold') as HTMLElement).click())
    await guest.waitForSelector('.handrow .tile', { timeout: 10000 })
    await host.waitForSelector('.handrow .tile', { timeout: 10000 })
    const hostPlay = autoPlay(host, 'host')
    const guestPlay = autoPlay(guest, 'guest')
    await sleep(6000)

    // 1. short drop (well inside the 8 s grace period)
    await guestPlay.stop()
    await dropConn(guest, 2500)
    await sleep(900)
    check('guest sees a reconnecting notice while offline', /reconnecting/i.test(await text(guest)))
    check('host sees the guest as away', /away/i.test(await text(host)))
    await sleep(4000)
    check('guest is back after the short drop (board visible)', (await guest.$('.handrow .tile')) !== null)
    check('guest keeps their seat (host no longer shows away)', !/\(away\)/i.test(await text(host)))
    const guestPlay2 = autoPlay(guest, 'guest')
    await sleep(5000)
    check('the guest can still play after reconnecting', (await pond(host, 'p1')) > 0)

    // 2. long drop: a bot must take over so the table never stalls
    await guestPlay2.stop()
    const before = await pond(host, 'p1')
    await dropConn(guest, 16000)
    await sleep(14000)
    const during = await pond(host, 'p1')
    check(`the table keeps moving while the guest is gone (guest seat discards ${before} -> ${during}, bot took over)`, during > before)
    await sleep(5000)
    check('guest reconnects after a long outage and sees the live game', (await guest.$('.handrow .tile')) !== null)
    const guestPlay3 = autoPlay(guest, 'guest')
    await sleep(8000)
    const after = await pond(host, 'p1')
    check(`the guest gets control back (discards ${during} -> ${after})`, after > during)
    await guestPlay3.stop()
    await hostPlay.stop()
  } finally {
    await browser.close()
  }
  console.log(fails ? `\n${fails} FAILED` : '\nreconnect flows ok')
  process.exit(fails ? 1 : 0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
